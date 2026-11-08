------------------------------- MODULE Queue -------------------------------
(*
  The generation queue and its one worker, as `service/queue.rs` and `service/worker.rs` move them.

  What is modelled: the status of each item, the worker's steps (take a pending item, start it, run it, end it) and
  every call a person can make while it runs (add, cancel one, cancel the waiting ones, clear, prune, retry, pause).
  Each call of queue.rs is one atomic step, because it runs under `queue_transition`. The worker's own steps are
  separate steps, because it releases the lock between them: that gap is what this model explores.

  What is not modelled: the order of the items (the worker may take ANY pending one here, which includes the real
  first-in-line choice), the contents of a job, persistence, events.
*)
EXTENDS Naturals, FiniteSets

CONSTANT MaxItems

Statuses == {"none", "pending", "inprogress", "completed", "failed", "canceled"}
Ended == {"completed", "failed", "canceled"}
Ids == 1..MaxItems

VARIABLES
  st,       \* st[i]: the status of item i; "none" when it does not exist (never made, cleared, or pruned)
  next,     \* the id the next item gets; only grows, also across a clear (NEXT_QUEUE_ID_META)
  paused,   \* the processor is paused
  running,  \* Inner state `running`: the id the worker holds, 0 for none
  cur,      \* the worker's own copy of the item it took
  tok,      \* the running job's cancellation token was cancelled
  pc        \* where the worker is: idle, picked, processing, endingOk, endingBad

vars == <<st, next, paused, running, cur, tok, pc>>

TypeOK ==
  /\ st \in [Ids -> Statuses]
  /\ next \in 1..(MaxItems + 1)
  /\ paused \in BOOLEAN
  /\ running \in 0..MaxItems
  /\ cur \in 0..MaxItems
  /\ tok \in BOOLEAN
  /\ pc \in {"idle", "picked", "processing", "endingOk", "endingBad"}

Init ==
  /\ st = [i \in Ids |-> "none"]
  /\ next = 1
  /\ paused = FALSE
  /\ running = 0
  /\ cur = 0
  /\ tok = FALSE
  /\ pc = "idle"

\* move_item: only from a status in `from`; an item that is gone or ended does not move.
Move(i, from, to) ==
  /\ st[i] \in from
  /\ st' = [st EXCEPT ![i] = to]

\* ---- calls of queue.rs (each one atomic) ----

\* enqueue (and retry, which enqueues a copy): a new item with a fresh id.
Enqueue ==
  /\ next <= MaxItems
  /\ st' = [st EXCEPT ![next] = "pending"]
  /\ next' = next + 1
  /\ UNCHANGED <<paused, running, cur, tok, pc>>

Retry(i) ==
  /\ st[i] \in {"failed", "canceled"}
  /\ Enqueue

\* cancel_queue_item: the token of the running item is cancelled and the item moves, in one step.
Cancel(i) ==
  /\ st[i] \in {"pending", "inprogress"}
  /\ st' = [st EXCEPT ![i] = "canceled"]
  /\ tok' = IF running = i THEN TRUE ELSE tok
  /\ UNCHANGED <<next, paused, running, cur, pc>>

\* cancel_pending: every waiting item at once; the running one is left alone.
CancelPending ==
  /\ \E i \in Ids : st[i] = "pending"
  /\ st' = [i \in Ids |-> IF st[i] = "pending" THEN "canceled" ELSE st[i]]
  /\ UNCHANGED <<next, paused, running, cur, tok, pc>>

\* clear_queue: the running token is cancelled, every row goes; `running` stays until the worker ends.
Clear ==
  /\ st' = [i \in Ids |-> "none"]
  /\ tok' = IF running # 0 THEN TRUE ELSE tok
  /\ UNCHANGED <<next, paused, running, cur, pc>>

\* prune_queue: ended items go, waiting and running ones stay.
Prune ==
  /\ st' = [i \in Ids |-> IF st[i] \in Ended THEN "none" ELSE st[i]]
  /\ UNCHANGED <<next, paused, running, cur, tok, pc>>

SetPaused(p) ==
  /\ paused' = p
  /\ UNCHANGED <<st, next, running, cur, tok, pc>>

\* ---- the worker (run_worker): a step per place it lets go of the lock ----

\* Takes a pending item and holds it in `running` (the state lock only, not queue_transition).
Pick ==
  /\ pc = "idle" /\ ~paused /\ running = 0
  /\ \E i \in Ids :
       /\ st[i] = "pending"
       /\ running' = i
       /\ cur' = i
  /\ tok' = FALSE
  /\ pc' = "picked"
  /\ UNCHANGED <<st, next, paused>>

\* start_item: pending to in progress, only if still pending. Otherwise `running` is let go.
Start ==
  /\ pc = "picked"
  /\ IF st[cur] = "pending"
       THEN /\ st' = [st EXCEPT ![cur] = "inprogress"]
            /\ pc' = "processing"
            /\ UNCHANGED running
       ELSE /\ running' = 0
            /\ pc' = "idle"
            /\ UNCHANGED st
  /\ UNCHANGED <<next, paused, cur, tok>>

\* process() answers Ok: it has already set the item to completed (set_status from pending or in progress).
FinishOk ==
  /\ pc = "processing"
  /\ st' = [st EXCEPT ![cur] = IF st[cur] \in {"pending", "inprogress"} THEN "completed" ELSE st[cur]]
  /\ pc' = "endingOk"
  /\ UNCHANGED <<next, paused, running, cur, tok>>

\* process() answers Err: `running` is let go first, then the item is marked.
FinishErr ==
  /\ pc = "processing"
  /\ running' = 0
  /\ pc' = "endingBad"
  /\ UNCHANGED <<st, next, paused, cur, tok>>

ReleaseOk ==
  /\ pc = "endingOk"
  /\ running' = 0
  /\ pc' = "idle"
  /\ UNCHANGED <<st, next, paused, cur, tok>>

\* Err(Cancelled) marks canceled; Err(Failed) marks failed unless the token was cancelled. Both leave an ended item alone.
MarkCancelled ==
  /\ pc = "endingBad"
  /\ st' = [st EXCEPT ![cur] = IF st[cur] \in {"pending", "inprogress"} THEN "canceled" ELSE st[cur]]
  /\ pc' = "idle"
  /\ UNCHANGED <<next, paused, running, cur, tok>>

MarkFailed ==
  /\ pc = "endingBad"
  /\ st' = [st EXCEPT ![cur] = IF ~tok /\ st[cur] \in {"pending", "inprogress"} THEN "failed" ELSE st[cur]]
  /\ pc' = "idle"
  /\ UNCHANGED <<next, paused, running, cur, tok>>

Next ==
  \/ Enqueue
  \/ \E i \in Ids : Retry(i) \/ Cancel(i)
  \/ CancelPending \/ Clear \/ Prune
  \/ SetPaused(TRUE) \/ SetPaused(FALSE)
  \/ Pick \/ Start \/ FinishOk \/ FinishErr \/ ReleaseOk \/ MarkCancelled \/ MarkFailed

Spec == Init /\ [][Next]_vars

\* ---- what must hold ----

\* One job at a time.
AtMostOneInProgress == Cardinality({i \in Ids : st[i] = "inprogress"}) <= 1

\* An item in progress is the worker's own, and the worker is running it or about to mark it.
InProgressIsTheWorkers ==
  \A i \in Ids : st[i] = "inprogress" => (i = cur /\ pc \in {"processing", "endingBad"})

\* `running` names the item the worker holds, and nothing when it holds none.
RunningMatchesWorker ==
  /\ (pc \in {"picked", "processing", "endingOk"}) <=> (running # 0)
  /\ running # 0 => running = cur

\* An id that was never given out has no item.
NoItemBeyondNext == \A i \in Ids : i >= next => st[i] = "none"

\* An ended item never moves again (it can only be removed), and a removed item never comes back:
\* a retry makes a new item with a new id.
EndedStaysEnded ==
  [][\A i \in Ids : st[i] \in Ended => st'[i] \in {st[i], "none"}]_vars
GoneStaysGone ==
  [][\A i \in Ids : (i < next /\ st[i] = "none") => st'[i] = "none"]_vars

=============================================================================
