// Compositions for manga panels: how much of the body shows, where it stands in the frame, and who else is there. Each
// scene is one or more people written in the short form of `poseShort.ts` plus `at: [neck x, neck y, size]` as fractions of
// the generation box (a size above 1 crops the body at the frame), and `back` for a person seen from behind. In a
// back view `ra` and `ll` and the other pairs keep naming the picture's sides (`ra` is the arm on the picture's left).
import { shortSpec, type Short } from './poseShort';
import type { PoseSpec } from './poseSpec';

type Person = Short & { at: [x: number, y: number, size: number]; back?: boolean };

const person = ({ at, back, ...shape }: Person): PoseSpec => ({ ...shortSpec(shape), neck: { x: at[0], y: at[1] }, size: at[2], ...(back ? { back: true } : {}) });

const hang: Short = { ra: [-8, -5], la: [8, 5] };
const walkA: Short = { t: 0.6, ra: [22, 40], la: [-20, -30], rl: [-20, -45], ll: [25, 5] };
const walkB: Short = { t: 0.6, ra: [-20, -30], la: [22, 40], rl: [25, 5], ll: [-20, -45] };
const run: Short = { t: 0.6, l: 12, ra: [-45, -110], la: [50, 150], rl: [-28, -115], ll: [70, 15] };
const sitFront: Short = { rl: [-6, 0, 0.42], ll: [6, 0, 0.42] };

const SCENES: readonly { category: string; scenes: readonly [id: string, people: Person[]][] }[] = [
  {
    category: 'shot',
    scenes: [
      ['faceCloseup', [{ at: [0.5, 0.92, 3.3], ...hang }]],
      ['bustUp', [{ at: [0.5, 0.42, 1.55], ...hang }]],
      ['bustUpLeft', [{ at: [0.32, 0.42, 1.55], t: 0.8, h: [0, 0.7], ...hang }]],
      ['bustUpRight', [{ at: [0.68, 0.46, 1.55], t: 0.8, h: [0, -0.7], ...hang }]],
      ['waistUp', [{ at: [0.5, 0.27, 1.3], ra: [-30, 40], la: [30, -40] }]],
      ['kneeShot', [{ at: [0.5, 0.17, 1.0], ra: [-38, 40], la: [38, -40] }]],
      ['fullBody', [{ at: [0.5, 0.17, 0.85], ...hang }]],
      ['distantFigure', [{ at: [0.5, 0.5, 0.26], ...hang }]],
      ['cornerFigure', [{ at: [0.8, 0.62, 0.4], ...walkA }]],
      ['leftThird', [{ at: [0.33, 0.18, 0.85], ra: [-8, 100], la: [8, -100] }]],
      ['rightThird', [{ at: [0.67, 0.18, 0.85], ra: [-18, 38], la: [8, 5], ll: [6, 3] }]],
      ['backView', [{ at: [0.5, 0.2, 0.85], back: true, ...hang }]],
      ['walkingAway', [{ at: [0.5, 0.42, 0.45], back: true, ra: [18, 30], la: [-18, -25], rl: [-16, -30], ll: [20, 5] }]],
    ],
  },
  {
    category: 'two',
    scenes: [
      [
        'faceToFace',
        [
          { at: [0.32, 0.2, 0.85], t: 0.5, h: [0, 0.9], ra: [-10, -5], la: [30, 60] },
          { at: [0.68, 0.2, 0.85], t: 0.5, h: [0, -0.9], ra: [-30, -60], la: [10, 5] },
        ],
      ],
      [
        'walkTogether',
        [
          { at: [0.33, 0.2, 0.85], h: [0, 0.8], ...walkA, t: 0.5 },
          { at: [0.62, 0.24, 0.78], h: [0, 0.8], ...walkB, t: 0.5 },
        ],
      ],
      [
        'backToBack',
        [
          { at: [0.41, 0.2, 0.85], t: 0.6, h: [0, -0.9], ra: [-38, 40], la: [38, -40] },
          { at: [0.59, 0.2, 0.85], t: 0.6, h: [0, 0.9], ra: [-38, 40], la: [38, -40] },
        ],
      ],
      [
        'overTheShoulder',
        [
          { at: [0.18, 0.55, 1.7], back: true, ...hang },
          { at: [0.66, 0.25, 0.75], t: 0.8, h: [0, -0.7], ra: [-20, 20], la: [10, 5] },
        ],
      ],
      [
        'adultAndChild',
        [
          { at: [0.38, 0.18, 0.85], ra: [-8, -5], la: [26, 12] },
          { at: [0.62, 0.4, 0.5], ra: [10, 15, 0.4], la: [8, 5] },
        ],
      ],
      [
        'holdingHands',
        [
          { at: [0.36, 0.2, 0.85], ra: [-8, -5], la: [14, 8] },
          { at: [0.64, 0.2, 0.85], ra: [-14, -8], la: [8, 5] },
        ],
      ],
      [
        'armAroundShoulders',
        [
          { at: [0.4, 0.2, 0.85], ra: [-8, -5], la: [75, 95, 0.8] },
          { at: [0.6, 0.2, 0.85], ra: [-30, -95], la: [8, 5] },
        ],
      ],
      [
        'embrace',
        [
          { at: [0.43, 0.22, 0.85], t: 0.8, h: [10, 0.6], ra: [-12, -4], la: [85, 110, 0.85] },
          { at: [0.57, 0.22, 0.85], t: 0.8, h: [-10, -0.6], ra: [-85, -110, 0.85], la: [12, 4] },
        ],
      ],
      [
        'piggyback',
        [
          { at: [0.52, 0.34, 0.8], l: 28, t: 0.55, h: [0, 0.6], rl: [-16, -30], ll: [14, 6], ra: [-35, -20], la: [-30, -15] },
          { at: [0.38, 0.2, 0.78], l: 20, t: 0.55, h: [0, 0.6], rl: [70, 10], ll: [75, 15], ra: [10, 45], la: [20, 50] },
        ],
      ],
      [
        'princessCarry',
        [
          { at: [0.55, 0.2, 0.92], ra: [-10, 80], la: [10, -80], rl: [-6, 0], ll: [6, 0] },
          { at: [0.28, 0.5, 0.62], l: -90, ra: [80, 80], la: [100, 95], rl: [88, 88], ll: [92, 92] },
        ],
      ],
      [
        'kneelingProposal',
        [
          { at: [0.32, 0.42, 0.8], t: 0.55, la: [40, -60], rl: [8, -80], ll: [14, -78] },
          { at: [0.7, 0.2, 0.85], ra: [-30, 150], la: [8, 5] },
        ],
      ],
      [
        'helpingUp',
        [
          { at: [0.3, 0.18, 0.85], l: 18, ra: [-10, -5], la: [60, 40], rl: [-20, 6], ll: [24, -10] },
          { at: [0.7, 0.55, 0.7], ra: [-110, -60], la: [30, 40], rl: [-70, 5, 0.6], ll: [60, 10, 0.6] },
        ],
      ],
      [
        'tableTalk',
        [
          { at: [0.28, 0.28, 0.8], h: [0, 0.6], ...sitFront, ra: [-12, 70], la: [12, 40] },
          { at: [0.72, 0.28, 0.8], h: [0, -0.6], ...sitFront, ra: [-12, -40], la: [12, -70] },
        ],
      ],
      [
        'sittingTogether',
        [
          { at: [0.4, 0.28, 0.8], ...sitFront, ra: [-12, 60], la: [12, -60] },
          { at: [0.6, 0.3, 0.8], h: [18, 0], ...sitFront, ra: [-12, 60], la: [12, -60] },
        ],
      ],
      [
        'standoff',
        [
          { at: [0.25, 0.2, 0.7], t: 0.7, h: [0, 0.8], ra: [-22, 150], la: [22, -150], rl: [-22, 10], ll: [22, -10] },
          { at: [0.75, 0.2, 0.7], t: 0.7, h: [0, -0.8], ra: [-22, 150], la: [22, -150], rl: [-22, 10], ll: [22, -10] },
        ],
      ],
      [
        'bladeClash',
        [
          { at: [0.38, 0.22, 0.8], t: 0.7, l: 12, h: [0, 0.8], ra: [-30, 60], la: [40, 80], rl: [-30, 10], ll: [25, -10] },
          { at: [0.62, 0.22, 0.8], t: 0.7, l: -12, h: [0, -0.8], ra: [-40, -80], la: [30, -60], rl: [-25, 10], ll: [30, -10] },
        ],
      ],
      [
        'palmStop',
        [
          { at: [0.3, 0.2, 0.85], l: 6, la: [88, 88], ra: [-10, -5] },
          { at: [0.72, 0.22, 0.85], l: -12, ra: [-60, 100], la: [20, 10], rl: [-14, 10], ll: [20, -10] },
        ],
      ],
      [
        'chase',
        [
          { at: [0.3, 0.34, 0.62], ...run },
          { at: [0.68, 0.28, 0.8], ...run },
        ],
      ],
      [
        'shieldingBehind',
        [
          { at: [0.4, 0.2, 0.85], ra: [-90, -90], la: [90, 90] },
          { at: [0.62, 0.3, 0.6], h: [0, -0.4], ...hang },
        ],
      ],
      [
        'lapPillow',
        [
          { at: [0.5, 0.3, 0.8], rl: [-55, 100, 0.8], ll: [55, -100, 0.8], ra: [-30, 60], la: [30, -40] },
          { at: [0.38, 0.72, 0.6], l: -90, ra: [80, 80], la: [100, 95], rl: [88, 88], ll: [92, 92] },
        ],
      ],
    ],
  },
  {
    category: 'group',
    scenes: [
      [
        'lineUpThree',
        [
          { at: [0.25, 0.22, 0.8], ...hang },
          { at: [0.5, 0.22, 0.8], ra: [-38, 40], la: [38, -40] },
          { at: [0.75, 0.22, 0.8], ra: [-8, 100], la: [8, -100] },
        ],
      ],
      [
        'triangleFront',
        [
          { at: [0.28, 0.2, 0.7], ...hang },
          { at: [0.72, 0.2, 0.7], ...hang },
          { at: [0.5, 0.3, 0.95], ra: [-38, 40], la: [38, -40] },
        ],
      ],
      [
        'backsToCamera',
        [
          { at: [0.3, 0.3, 0.7], back: true, ...hang },
          { at: [0.55, 0.25, 0.6], back: true, ...hang },
          { at: [0.76, 0.22, 0.5], back: true, ...hang },
        ],
      ],
      [
        'surrounded',
        [
          { at: [0.18, 0.28, 0.55], t: 0.7, h: [0, 0.8], ra: [-22, 150], la: [22, -150], rl: [-22, 10], ll: [22, -10] },
          { at: [0.82, 0.28, 0.55], t: 0.7, h: [0, -0.8], ra: [-22, 150], la: [22, -150], rl: [-22, 10], ll: [22, -10] },
          { at: [0.5, 0.1, 0.5], ...hang },
          { at: [0.5, 0.4, 0.8], ra: [-150, 150], la: [150, -150], rl: [-8, 0], ll: [8, 0] },
        ],
      ],
      [
        'groupPhoto',
        [
          { at: [0.3, 0.16, 0.62], ...hang },
          { at: [0.5, 0.16, 0.62], ...hang },
          { at: [0.7, 0.16, 0.62], ...hang },
          { at: [0.4, 0.5, 0.55], ra: [-30, 60], la: [30, -60], rl: [-45, 8, 0.6], ll: [45, -8, 0.6] },
          { at: [0.62, 0.5, 0.55], ra: [-30, 60], la: [30, -60], rl: [-45, 8, 0.6], ll: [45, -8, 0.6] },
        ],
      ],
      [
        'runningTogether',
        [
          { at: [0.25, 0.33, 0.6], ...run },
          { at: [0.5, 0.3, 0.7], ...run },
          { at: [0.78, 0.25, 0.8], ...run },
        ],
      ],
      [
        'crowdFar',
        [
          { at: [0.5, 0.55, 1.3], back: true, ...hang },
          { at: [0.15, 0.22, 0.2], ...hang },
          { at: [0.3, 0.2, 0.2], ...hang },
          { at: [0.45, 0.22, 0.2], ...hang },
          { at: [0.6, 0.2, 0.2], ...hang },
          { at: [0.75, 0.22, 0.2], ...hang },
          { at: [0.88, 0.2, 0.2], ...hang },
        ],
      ],
      [
        'marchingFile',
        [
          { at: [0.28, 0.3, 0.9], ...walkA, t: 0.9 },
          { at: [0.54, 0.22, 0.7], ...walkB, t: 0.9 },
          { at: [0.76, 0.17, 0.55], ...walkA, t: 0.9 },
        ],
      ],
    ],
  },
  {
    category: 'daily',
    scenes: [
      ['readingAtDesk', [{ at: [0.45, 0.3, 0.95], t: 0.55, l: 15, h: [15, 0.8], ra: [20, 70], la: [25, 75], rl: [85, 5], ll: [88, 3] }]],
      ['eating', [{ at: [0.5, 0.26, 0.85], ...sitFront, ra: [-25, 145], la: [14, -60] }]],
      ['lookingAtPhone', [{ at: [0.5, 0.2, 0.85], h: [20, 0], ra: [-8, -5], la: [14, -150] }]],
      ['holdingCup', [{ at: [0.5, 0.2, 0.85], h: [-8, 0], ra: [-8, -5], la: [20, -165] }]],
      ['underUmbrella', [{ at: [0.5, 0.2, 0.85], ra: [-40, -170], la: [8, 5] }]],
      ['holdingStrap', [{ at: [0.5, 0.2, 0.85], l: 5, la: [170, 178], ra: [-8, -4], rl: [-10, 0], ll: [12, 4] }]],
      ['sleeping', [{ at: [0.2, 0.55, 0.7], l: -90, ra: [85, 85], la: [95, 95], rl: [88, 88], ll: [92, 92] }]],
      ['hugKnees', [{ at: [0.5, 0.4, 0.9], ra: [-25, 60], la: [25, -60], rl: [-165, -10, 0.45], ll: [165, 10, 0.45] }]],
      ['windowGazing', [{ at: [0.5, 0.2, 0.85], l: 4, t: 0.6, h: [0, 0.9], la: [100, 140], ra: [-8, -5] }]],
      ['tyingShoes', [{ at: [0.45, 0.42, 0.8], l: 40, rl: [-45, 8, 0.6], ll: [45, -8, 0.6], ra: [-10, -5], la: [20, 10] }]],
      ['cooking', [{ at: [0.5, 0.2, 0.85], l: 8, ra: [-18, 8, 0.6], la: [18, -8, 0.6] }]],
      ['selfie', [{ at: [0.5, 0.22, 0.85], h: [8, 0], ra: [-70, -80, 0.5], la: [40, -100] }]],
    ],
  },
  {
    category: 'drama',
    scenes: [
      ['startled', [{ at: [0.5, 0.2, 0.85], l: -14, h: [0, -0.6], ra: [-110, -70], la: [90, 60], rl: [-14, 10], ll: [18, -10] }]],
      ['reachingOut', [{ at: [0.3, 0.3, 1.1], l: 16, t: 0.7, la: [92, 92], ra: [-30, -70], rl: [-25, 10], ll: [24, -20] }]],
      ['fallingBack', [{ at: [0.5, 0.25, 0.9], l: -40, ra: [-110, -170], la: [110, 160], rl: [20, 40], ll: [60, 100] }]],
      [
        'standingOver',
        [
          { at: [0.35, 0.18, 1.0], h: [20, 0], ra: [-8, 100], la: [8, -100] },
          { at: [0.55, 0.84, 0.5], l: -90, ra: [80, 80], la: [100, 95], rl: [88, 88], ll: [92, 92] },
        ],
      ],
      ['lookingUp', [{ at: [0.5, 0.22, 0.85], h: [25, 0], ...hang }]],
      ['fleeingLookingBack', [{ at: [0.55, 0.25, 0.85], h: [0, -1], ...run }]],
      ['collapsing', [{ at: [0.5, 0.4, 0.8], l: 40, t: 0.8, ra: [-5, -3], la: [10, 5], rl: [-40, -100, 0.8], ll: [40, -95, 0.8] }]],
      ['peekingOut', [{ at: [0.22, 0.42, 1.0], l: 12, h: [6, 0.8], ra: [-20, 40], la: [10, 5] }]],
      ['farewellWave', [{ at: [0.8, 0.6, 0.32], ra: [-115, -170], la: [8, 5] }]],
      ['pointingAtViewer', [{ at: [0.5, 0.42, 1.6], t: 0.9, ra: [-90, -90, 0.45], la: [8, 5] }]],
      ['holdingHead', [{ at: [0.5, 0.24, 0.9], l: 10, ra: [-125, 140], la: [125, -140] }]],
    ],
  },
];

/** The compositions by category: each scene is a list of people as `PoseSpec`s with their places. */
export const PANEL_POSES: readonly { category: string; scenes: readonly [id: string, people: readonly PoseSpec[]][] }[] = SCENES.map(({ category, scenes }) => ({
  category,
  scenes: scenes.map(([id, people]) => [id, people.map(person)] as [string, PoseSpec[]]),
}));
