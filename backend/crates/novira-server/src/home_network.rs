//! What "the home network" is for `Reach::HomeNetwork`: the devices on the same subnet as the address of this computer a
//! connection came in on, when that address is one a home router hands out. A home network is not told by an address
//! range alone: some home routers hand out `100.64.0.0/10`, the range an internet provider also uses for many customers
//! at once, so the subnet of this computer's own interface decides.
use std::net::{IpAddr, Ipv4Addr};

/// Whether this computer's address is one a home router hands out: private (`10/8`, `172.16/12`, `192.168/16`) or shared
/// (`100.64/10`). A public address means the computer sits straight on the internet, where its subnet is other people's.
pub fn is_home_range(ip: Ipv4Addr) -> bool {
    let [a, b, ..] = ip.octets();
    ip.is_private() || (a == 100 && (b & 0xC0) == 64)
}

/// Whether `peer` is on the subnet `local`/`mask` (this computer's own address included), the subnet being at most a
/// `/8` and not a single address.
pub fn same_subnet(peer: Ipv4Addr, local: Ipv4Addr, mask: Ipv4Addr) -> bool {
    let (p, l, m) = (u32::from(peer), u32::from(local), u32::from(mask));
    let prefix = m.leading_ones();
    // A mask is a run of ones; anything else is not a subnet.
    if m.count_ones() != prefix || !(8..=31).contains(&prefix) {
        return false;
    }
    p & m == l & m
}

/// Whether a connection that came in on `local` (whose subnet mask is `mask`) from `peer` is from the home network.
pub fn is_home_peer(peer: IpAddr, local: IpAddr, mask: Option<Ipv4Addr>) -> bool {
    match (peer, local, mask) {
        (IpAddr::V4(peer), IpAddr::V4(local), Some(mask)) => {
            is_home_range(local) && same_subnet(peer, local, mask)
        }
        _ => false,
    }
}

/// The system's row for this computer's IPv4 address `ip`: its interface index and subnet mask; `None` when no
/// interface has it.
#[cfg(windows)]
fn address_row(ip: Ipv4Addr) -> Option<(u32, Ipv4Addr)> {
    use std::mem::size_of;
    use windows_sys::Win32::NetworkManagement::IpHelper::{
        GetIpAddrTable, MIB_IPADDRROW_XP, MIB_IPADDRTABLE,
    };
    let (buffer, filled) = read_table(|table, size| {
        // SAFETY: `table` points at `*size` writable bytes, which the call fills and reports back.
        unsafe { GetIpAddrTable(table.cast(), size, 0) }
    })?;
    let table = buffer.as_ptr().cast::<MIB_IPADDRTABLE>();
    // SAFETY: the call wrote the header; only as many rows as fit in the bytes it reported are read.
    let rows = unsafe {
        let fits = filled.saturating_sub(size_of::<u32>()) / size_of::<MIB_IPADDRROW_XP>();
        let count = ((*table).dwNumEntries as usize).min(fits);
        std::slice::from_raw_parts((*table).table.as_ptr(), count)
    };
    // The table keeps addresses in network byte order, so their bytes in memory are the octets.
    rows.iter()
        .find(|row| Ipv4Addr::from(row.dwAddr.to_ne_bytes()) == ip)
        .map(|row| (row.dwIndex, Ipv4Addr::from(row.dwMask.to_ne_bytes())))
}

/// Fills a buffer (aligned for the tables' `u32` fields) through `call`, which gets the buffer and its size and
/// returns the system's error code; a table that grew in between is asked for again. The bytes filled come back.
#[cfg(windows)]
fn read_table(call: impl Fn(*mut core::ffi::c_void, *mut u32) -> u32) -> Option<(Vec<u64>, usize)> {
    const NO_ERROR: u32 = 0;
    const ERROR_INSUFFICIENT_BUFFER: u32 = 122;
    let mut size = 0usize;
    for _ in 0..4 {
        let mut buffer = vec![0u64; size.div_ceil(8).max(1)];
        let mut filled = (buffer.len() * 8) as u32;
        match call(buffer.as_mut_ptr().cast(), &mut filled) {
            NO_ERROR => return Some((buffer, filled as usize)),
            ERROR_INSUFFICIENT_BUFFER => size = filled as usize,
            _ => return None,
        }
    }
    None
}

/// The subnet mask of this computer's IPv4 address `ip`, from the system's address table; `None` when no interface has it.
#[cfg(windows)]
pub fn subnet_mask_of(ip: Ipv4Addr) -> Option<Ipv4Addr> {
    address_row(ip).map(|(_, mask)| mask)
}

/// The hardware address of the default gateway of the interface that has `ip`: the next hop of that interface's
/// default route (`GetIpForwardTable`), looked up in the neighbour table (`GetIpNetTable`) and asked for with ARP
/// when it is not there yet (`SendARP`). `None` when there is no such route (a link without a gateway), the
/// gateway does not answer, or the answer cannot name a gateway. It is what tells one network from another.
#[cfg(windows)]
pub fn gateway_mac(ip: Ipv4Addr) -> Option<crate::trusted::Mac> {
    use std::mem::size_of;
    use windows_sys::Win32::NetworkManagement::IpHelper::{
        GetIpForwardTable, GetIpNetTable, SendARP, MIB_IPFORWARDROW, MIB_IPFORWARDTABLE,
        MIB_IPNETROW_LH, MIB_IPNETTABLE,
    };
    const DYNAMIC: u32 = 3;
    const STATIC: u32 = 4;
    let (index, _) = address_row(ip)?;
    let (buffer, filled) = read_table(|table, size| {
        // SAFETY: as for the address table.
        unsafe { GetIpForwardTable(table.cast(), size, 0) }
    })?;
    let table = buffer.as_ptr().cast::<MIB_IPFORWARDTABLE>();
    // SAFETY: as for the address table.
    let routes = unsafe {
        let fits = filled.saturating_sub(size_of::<u32>()) / size_of::<MIB_IPFORWARDROW>();
        let count = ((*table).dwNumEntries as usize).min(fits);
        std::slice::from_raw_parts((*table).table.as_ptr(), count)
    };
    // The default route of this interface with the lowest metric; its next hop is the gateway.
    let hop = routes
        .iter()
        .filter(|r| r.dwForwardDest == 0 && r.dwForwardMask == 0 && r.dwForwardIfIndex == index)
        .min_by_key(|r| r.dwForwardMetric1)
        .map(|r| Ipv4Addr::from(r.dwForwardNextHop.to_ne_bytes()))
        .filter(|hop| !hop.is_unspecified())?;
    let neighbours = read_table(|table, size| {
        // SAFETY: as for the address table.
        unsafe { GetIpNetTable(table.cast(), size, 0) }
    });
    let known = neighbours.and_then(|(buffer, filled)| {
        let table = buffer.as_ptr().cast::<MIB_IPNETTABLE>();
        // SAFETY: as for the address table.
        let rows = unsafe {
            let fits = filled.saturating_sub(size_of::<u32>()) / size_of::<MIB_IPNETROW_LH>();
            let count = ((*table).dwNumEntries as usize).min(fits);
            std::slice::from_raw_parts((*table).table.as_ptr(), count)
        };
        rows.iter()
            .find(|row| {
                // SAFETY: the union is a `u32` in every reading.
                let kind = unsafe { row.Anonymous.dwType };
                row.dwIndex == index
                    && Ipv4Addr::from(row.dwAddr.to_ne_bytes()) == hop
                    && row.dwPhysAddrLen == 6
                    && (kind == DYNAMIC || kind == STATIC)
            })
            .map(|row| {
                let mut mac = [0u8; 6];
                mac.copy_from_slice(&row.bPhysAddr[..6]);
                mac
            })
    });
    let mac = known.or_else(|| {
        // Not in the cache yet: ask the gateway.
        let mut mac = [0u8; 8];
        let mut len = mac.len() as u32;
        // SAFETY: `mac` has `len` writable bytes, which the call fills and reports back.
        let result = unsafe {
            SendARP(
                u32::from_ne_bytes(hop.octets()),
                u32::from_ne_bytes(ip.octets()),
                mac.as_mut_ptr().cast(),
                &mut len,
            )
        };
        (result == 0 && len == 6).then(|| [mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]])
    })?;
    crate::trusted::usable(&mac).then_some(mac)
}

/// Outside Windows the mask is not looked up, so no device of the home network is answered.
#[cfg(not(windows))]
pub fn subnet_mask_of(_ip: Ipv4Addr) -> Option<Ipv4Addr> {
    None
}

/// Outside Windows the gateway is not looked up, so no network is known and none is trusted: the home-network
/// listener never opens.
#[cfg(not(windows))]
pub fn gateway_mac(_ip: Ipv4Addr) -> Option<crate::trusted::Mac> {
    None
}

/// Whether this computer is on a network Windows classifies as public (a café, an airport). `Some(true)` when any
/// connected network is public, `Some(false)` when every connected network is private or domain, `None` when it cannot
/// be told (no COM, a query error). It is a warning beside the trusted-network check, not a gate.
#[cfg(windows)]
pub fn network_is_public() -> Option<bool> {
    // The COM calls run on their own thread, so the server's async runtime is left alone.
    std::thread::spawn(connected_networks_public).join().ok()?
}

/// The Network List Manager's view of the connected networks: `Some(true)` if any is public. COM is set up and torn
/// down on the calling thread.
#[cfg(windows)]
fn connected_networks_public() -> Option<bool> {
    use windows::core::Result as HResult;
    use windows::Win32::Networking::NetworkListManager::{
        IEnumNetworks, INetwork, INetworkListManager, NetworkListManager,
        NLM_ENUM_NETWORK_CONNECTED, NLM_NETWORK_CATEGORY_PUBLIC,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_APARTMENTTHREADED,
    };
    // SAFETY: COM is initialised and uninitialised on this one thread; every interface pointer comes from a call that
    // was checked for success before it is used.
    unsafe {
        // A failure here (already initialised another way on this thread) does not stop the query.
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let query = || -> HResult<bool> {
            let manager: INetworkListManager =
                CoCreateInstance(&NetworkListManager, None, CLSCTX_ALL)?;
            let networks: IEnumNetworks = manager.GetNetworks(NLM_ENUM_NETWORK_CONNECTED)?;
            let mut any_public = false;
            loop {
                let mut batch: [Option<INetwork>; 1] = [None];
                let mut fetched = 0u32;
                networks.Next(&mut batch, Some(&mut fetched))?;
                if fetched == 0 {
                    break;
                }
                if let Some(network) = batch[0].take() {
                    if network.GetCategory()? == NLM_NETWORK_CATEGORY_PUBLIC {
                        any_public = true;
                    }
                }
            }
            Ok(any_public)
        };
        let result = query().ok();
        CoUninitialize();
        result
    }
}

/// Outside Windows the network category is not read.
#[cfg(not(windows))]
pub fn network_is_public() -> Option<bool> {
    None
}

/// This computer's address on the home network, as the routing table picks it for an address off the local network.
/// Nothing is sent: a UDP socket is only connected, which picks the interface. The target is in `192.0.2.0/24`, a block
/// kept for documentation that is never in use. `None` when that address is not one a home router hands out (no home
/// network, or the computer is connected straight to the internet).
pub fn home_address() -> Option<Ipv4Addr> {
    let socket = std::net::UdpSocket::bind((Ipv4Addr::UNSPECIFIED, 0)).ok()?;
    socket.connect((Ipv4Addr::new(192, 0, 2, 1), 9)).ok()?;
    match socket.local_addr().ok()?.ip() {
        IpAddr::V4(ip) if is_home_range(ip) => Some(ip),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn v4(s: &str) -> Ipv4Addr {
        s.parse().unwrap()
    }

    #[test]
    fn the_ranges_a_home_router_hands_out_are_private_and_shared_ones() {
        for home in [
            "10.0.0.5",
            "172.16.0.1",
            "172.31.255.254",
            "192.168.1.5",
            "100.64.0.1",
            "100.64.1.60",
            "100.127.255.254",
        ] {
            assert!(is_home_range(v4(home)), "{home}");
        }
        for not in [
            "8.8.8.8",
            "172.15.255.255",
            "172.32.0.1",
            "100.63.255.255",
            "100.128.0.1",
            "169.254.1.1",
            "127.0.0.1",
            "0.0.0.0",
            "255.255.255.255",
            "192.0.2.1",
        ] {
            assert!(!is_home_range(v4(not)), "{not}");
        }
    }

    #[test]
    fn a_peer_is_home_only_on_the_same_subnet_of_a_home_address() {
        let mask24 = v4("255.255.255.0");
        assert!(same_subnet(v4("100.64.1.20"), v4("100.64.1.60"), mask24));
        assert!(same_subnet(v4("192.168.1.254"), v4("192.168.1.5"), mask24));
        // This computer opening its own home address is on it.
        assert!(same_subnet(v4("192.168.1.5"), v4("192.168.1.5"), mask24));
        // Another subnet, and masks that are not one.
        assert!(!same_subnet(v4("100.64.2.20"), v4("100.64.1.60"), mask24));
        assert!(!same_subnet(
            v4("10.1.2.3"),
            v4("10.9.9.9"),
            v4("255.0.255.0")
        ));
        assert!(!same_subnet(v4("10.1.2.3"), v4("10.9.9.9"), v4("0.0.0.0")));
        assert!(!same_subnet(
            v4("10.1.2.3"),
            v4("10.1.2.4"),
            v4("255.255.255.255")
        ));
        // A /8 is the widest subnet taken; a /7 would reach past a private range.
        assert!(same_subnet(
            v4("10.200.0.1"),
            v4("10.0.0.1"),
            v4("255.0.0.0")
        ));
        assert!(!same_subnet(
            v4("11.0.0.1"),
            v4("10.0.0.1"),
            v4("254.0.0.0")
        ));

        let local = IpAddr::V4(v4("100.64.1.60"));
        assert!(is_home_peer(
            IpAddr::V4(v4("100.64.1.20")),
            local,
            Some(mask24)
        ));
        assert!(
            !is_home_peer(IpAddr::V4(v4("100.64.1.20")), local, None),
            "no known mask"
        );
        // On a public address the subnet is the provider's other customers.
        assert!(!is_home_peer(
            IpAddr::V4(v4("203.0.113.9")),
            IpAddr::V4(v4("203.0.113.5")),
            Some(mask24)
        ));
        assert!(!is_home_peer("::1".parse().unwrap(), local, Some(mask24)));
    }

    #[cfg(windows)]
    #[test]
    fn the_loopback_address_has_its_mask_in_the_system_table() {
        assert_eq!(subnet_mask_of(Ipv4Addr::LOCALHOST), Some(v4("255.0.0.0")));
        assert_eq!(subnet_mask_of(v4("192.0.2.1")), None);
    }

    #[cfg(windows)]
    #[test]
    fn the_gateway_is_told_only_for_an_address_with_a_default_route() {
        // Loopback and an address no interface has have no gateway.
        assert_eq!(gateway_mac(Ipv4Addr::LOCALHOST), None);
        assert_eq!(gateway_mac(v4("192.0.2.1")), None);
        // On a home address the answer, when there is one, names a real gateway (this only asks the system and the
        // gateway; it listens on nothing).
        if let Some(ip) = home_address() {
            if let Some(mac) = gateway_mac(ip) {
                assert!(crate::trusted::usable(&mac), "{mac:?}");
                assert_eq!(gateway_mac(ip), Some(mac), "the same twice");
            }
        }
    }

    #[cfg(windows)]
    #[test]
    fn the_network_category_is_read_through_com_without_panic() {
        // Mainly a check that the COM query runs and returns a value; a developer's machine is not a public network,
        // so the result is Some(false) (private/domain) or None (the query could not be made), never Some(true).
        assert_ne!(
            network_is_public(),
            Some(true),
            "this machine should not be classified as a public network"
        );
    }
}
