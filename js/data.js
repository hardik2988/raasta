/*
  Campus data for Raasta (UPES Bidholi wayfinder).

  All coordinates are in the pixel space of the map image (1045 x 756).
  The map is SCHEMATIC: it is traced from a satellite/road map and simplified,
  so distances are estimates. Road names below are descriptive labels for this
  project, not official names. Rename them if you know the real ones.

  To fix a wrong position: change the x/y of a place, or the node it
  connects to. To add a place: add one line to `places` and give it a `node`.
*/
const CAMPUS = {
  mapSize: { w: 1045, h: 756 },
  metersPerPx: 1,          // rough estimate from the map scale bar

  categories: {
    academic: { label: 'Academic',        color: '#24628f', shape: 'circle',   code: 'C' }, // 'C' (classroom), so it never clashes with the route's A/B pins
    hostel:   { label: 'Hostels',         color: '#b8661c', shape: 'square',   code: 'H' },
    food:     { label: 'Food & services', color: '#9a3f7c', shape: 'diamond',  code: 'F' },
    sports:   { label: 'Sports',          color: '#3d8062', shape: 'triangle', code: 'S' },
    admin:    { label: 'Administration',  color: '#6f5596', shape: 'hexagon',  code: 'M' },
    landmark: { label: 'Landmarks',       color: '#4f8584', shape: 'shield',   code: 'L' }, // chowks, squares and meeting points
    gate:     { label: 'Gates',           color: '#780000', shape: 'arch',     code: 'G' }, // campus entrances and exits
    children: { label: 'Children services', color: '#4f5fb5', shape: 'star',   code: 'K' }  // kindergarten, day care
  },

  // id, name, category, x, y, road-node it connects to, label side (r/l/t/b), search aliases
  places: [
    { id: 'playground', name: 'PlayGround',                    cat: 'sports',   x: 534, y: 158, node: 'pl_1',   side: 'r', aliases: ['cricket', 'ground', 'field', 'sports', 'football'] },
    { id: 'mdc',        name: 'Management Development Centre', cat: 'admin',    x: 711, y: 186, node: 'sp_mdc', side: 'r', aliases: ['mdc', 'management', 'admin', 'mba', 'som', 'centre'] },
    { id: 'girls',      name: 'Girls Hostel',                  cat: 'hostel',   x: 923, y: 293, node: 'gh',     side: 'b', aliases: ['girls', 'gh', 'girls hostel', 'women hostel', 'hostel'] },
    { id: 'library',    name: 'Library',                       cat: 'academic', x: 426, y: 386, node: 'lb_1',   side: 'l', aliases: ['lib', 'central library', 'reading room', 'books', 'study'] },
    { id: 'it',         name: 'IT Block',                      cat: 'academic', x: 492, y: 403, node: 'it_1',   side: 'r', aliases: ['it', 'it block', 'computer', 'cse', 'cs', 'labs'] },
    { id: 'b8',         name: 'Block 8',                       cat: 'academic', x: 565, y: 423, node: 'it_2',   side: 'r', aliases: ['b8', 'block 8', 'block-8', '8'] },
    { id: 'b6',         name: 'Block 6',                       cat: 'academic', x: 499, y: 458, node: 'm3',     side: 'l', aliases: ['b6', 'block 6', 'block-6', '6'] },
    { id: 'b7',         name: 'Block 7',                       cat: 'academic', x: 545, y: 477, node: 'm4',     side: 'r', aliases: ['b7', 'block 7', 'block-7', '7'] },
    { id: 'boys',       name: 'Boys Hostel',                   cat: 'hostel',   x: 730, y: 493, node: 'se_2',   side: 'r', aliases: ['boys', 'bh', 'boys hostel', 'men hostel', 'hostel'] },
    { id: 'b1',         name: 'Block 1',                       cat: 'academic', x: 356, y: 551, node: 'b1',     side: 'l', aliases: ['b1', 'block 1', 'block-1', '1'] },
    { id: 'b2',         name: 'Block 2',                       cat: 'academic', x: 472, y: 545, node: 'ir_2',   side: 'l', aliases: ['b2', 'block 2', 'block-2', '2'] },
    { id: 'b3',         name: 'Block 3',                       cat: 'academic', x: 522, y: 566, node: 'ir_2',   side: 'r', aliases: ['b3', 'block 3', 'block-3', '3'] },
    { id: 'kinder',     name: 'Kinder Garden',                 cat: 'children', x: 711, y: 574, node: 'se_2',   side: 't', aliases: ['kinder', 'kg', 'kinder garden', 'kindergarten', 'daycare', 'day care', 'children', 'kids', 'creche', 'nursery'] },
    { id: 'lab',        name: 'Laboratory Block',              cat: 'academic', x: 839, y: 574, node: 'se_4',   side: 'r', aliases: ['lab', 'labs', 'laboratory', 'research block'] },
    { id: 'b9',         name: 'Block 9',                       cat: 'academic', x: 642, y: 596, node: 'se_1',   side: 'l', aliases: ['b9', 'block 9', 'block-9', '9'] },
    { id: 'b4',         name: 'Block 4',                       cat: 'academic', x: 436, y: 616, node: 'ir_3',   side: 'l', aliases: ['b4', 'block 4', 'block-4', '4'] },
    { id: 'b5',         name: 'Block 5',                       cat: 'academic', x: 499, y: 632, node: 'ir_4',   side: 'r', aliases: ['b5', 'block 5', 'block-5', '5'] },
    { id: 'b10',        name: 'Block 10',                      cat: 'academic', x: 719, y: 642, node: 'b10_b',  side: 'l', aliases: ['b10', 'block 10', 'block-10', '10'] },
    { id: 'hubble',     name: 'HUBBLE',                        cat: 'admin',    x: 330, y: 648, node: 'bt_a',   side: 'l', aliases: ['hubble', 'hub', 'astronomy', 'space'] },
    { id: 'foodcourt',  name: 'Food Court',                    cat: 'food',     x: 449, y: 687, node: 'fc',     side: 'b', aliases: ['food court', 'canteen', 'cafeteria', 'cafe', 'mess', 'food'] },
    { id: 'b11',        name: 'Block 11',                      cat: 'academic', x: 809, y: 686, node: 'ch_w',   side: 'r', aliases: ['b11', 'block 11', 'block-11', '11'] },
    { id: 'main_gate',  name: 'Main Gate',                     cat: 'gate',     x: 188, y: 684, node: 'bt_w',   side: 'r', aliases: ['gate', 'main entrance', 'entrance', 'entry', 'security'] },
    { id: 'basketball_court', name: 'Basketball Court',        cat: 'sports',   x: 627, y: 250, node: 'pl_2',   side: 'r', aliases: ['basketball', 'court', 'bball', 'hoops'] },
    { id: 'cricket_badminton_volley', name: 'Cricket, Badminton & Volleyball Courts', cat: 'sports', x: 456, y: 277, node: 'lb_1', side: 'l', aliases: ['cricket', 'nets', 'badminton', 'volleyball', 'volley ball', 'courts'] },
    { id: 'gandhi_chowk', name: 'Gandhi Chowk',                cat: 'landmark', x: 601, y: 530, node: 'rb',     side: 'r', aliases: ['gandhi', 'chowk', 'roundabout', 'circle', 'statue', 'square'] },
    { id: 'cafe_frisco', name: 'Cafe Frisco',                  cat: 'food',     x: 525, y: 600, node: 's_1',    side: 'l', aliases: ['frisco', 'cafe', 'coffee', 'snacks', 'food'] },
    { id: 'chai_tapri', name: 'Chai Tapri',                    cat: 'food',     x: 439, y: 581, node: 'ir_3',   side: 'l', aliases: ['chai', 'tapri', 'tea', 'tea stall', 'snacks'] },
    { id: 'tullip_cafe', name: 'Tullip Cafe',                  cat: 'food',     x: 761, y: 574, node: 'se_3',   side: 'b', aliases: ['tullip', 'tulip', 'tulip cafe', 'cafe', 'coffee'] },
    { id: 'multi_activity_centre_ma', name: 'Multi Activity Centre (MAC)', cat: 'admin', x: 295, y: 415, node: 'lb_w2', side: 'l', aliases: ['mac', 'multi activity centre', 'activity centre', 'activity center', 'gym', 'events', 'auditorium'] },
    { id: 'enrollment_centre', name: 'Enrollment Centre',      cat: 'admin',    x: 222, y: 544, node: 'w_2',    side: 'l', aliases: ['enrollment', 'enrolment', 'admission', 'admissions', 'registration', 'enquiry', 'fees'] },
    { id: 'back_gate', name: 'Back Gate',                      cat: 'gate',     x: 796, y: 250, node: 'bid_n',  side: 'r', aliases: ['back gate', 'rear gate', 'gate', 'bidholi gate', 'exit'] }
  ],

  // Road junctions: id -> [x, y]
  nodes: {
    // spine road (runs north to south down the middle of the campus)
    sp_top: [688, 214], sp_mdc: [690, 248], sp_play: [665, 290], sp_lib: [638, 405],
    sp_2: [622, 456], sp_3: [612, 480], rb: [600, 527],
    // east side, towards Bidholi Road
    bid_n: [795, 250], bid_s: [798, 278], gh: [880, 306],
    // playground road
    pl_1: [540, 238], pl_2: [600, 265],
    // library loop
    lb_nw: [370, 300], lb_1: [440, 336], lb_2: [540, 372], lb_w1: [335, 390], lb_w2: [318, 430],
    wst: [312, 452],
    // main road
    b1_top: [336, 464], m1: [410, 478], m2: [470, 497], m3: [512, 506], m3b: [535, 511], m4: [560, 518],
    // IT block lane
    it_1: [488, 418], it_2: [545, 436],
    // lane between blocks 2-5
    ir_2: [495, 575], ir_3: [480, 610], ir_4: [500, 652],
    // south road
    s_1: [550, 592], s_2: [520, 650], bt_e: [508, 660],
    // bottom road
    fc: [460, 648], bt_d: [440, 642], bt_c: [395, 678], bt_b: [350, 708], bt_a: [300, 690], bt_w: [245, 668],
    // west road
    w_1: [268, 500], w_2: [262, 550], sw: [270, 606],
    // block 1 lane
    b1: [322, 545], b1_bot: [302, 606],
    // south-east road towards Chitrakoot
    se_1: [660, 548], se_2: [715, 570], se_3: [770, 595], se_4: [815, 612], se_5: [878, 640],
    // Chitrakoot loop
    ch_w: [762, 650], ch_sw: [748, 700], ch_se: [860, 722], ch_e: [872, 690],
    // block 10 lane
    b10_a: [705, 600], b10_b: [690, 660]
  },

  // Road segments: [from node, to node, road name, optional edge options]
  edges: [
    ['sp_top', 'sp_mdc', 'Spine Road'], ['sp_mdc', 'sp_play', 'Spine Road'], ['sp_play', 'sp_lib', 'Spine Road'],
    ['sp_lib', 'sp_2', 'Spine Road'], ['sp_2', 'sp_3', 'Spine Road'], ['sp_3', 'rb', 'Spine Road'],

    ['pl_1', 'pl_2', 'Playground Road'], ['pl_2', 'sp_play', 'Playground Road'],

    ['lb_nw', 'lb_1', 'Library Road'], ['lb_1', 'lb_2', 'Library Road'], ['lb_2', 'sp_lib', 'Library Road'],
    ['lb_nw', 'lb_w1', 'Library Road'], ['lb_w1', 'lb_w2', 'Library Road'], ['lb_w2', 'wst', 'Library Road'],

    ['wst', 'b1_top', 'Main Road'], ['b1_top', 'm1', 'Main Road'], ['m1', 'm2', 'Main Road'],
    ['m2', 'm3', 'Main Road'], ['m3', 'm3b', 'Main Road'], ['m3b', 'm4', 'Main Road'], ['m4', 'rb', 'Main Road'],

    ['it_1', 'it_2', 'IT Block Lane'], ['it_2', 'sp_2', 'IT Block Lane'], ['it_1', 'm2', 'IT Block Lane'],
    ['it_2', 'm3b', 'IT Block Lane'],

    // short footpath so the Library and IT Block are not a long detour apart
    ['lb_1', 'it_1', 'Campus Walk'],

    ['m3', 'ir_2', 'Block Lane'], ['ir_2', 'ir_3', 'Block Lane'], ['ir_3', 'ir_4', 'Block Lane'], ['ir_4', 'bt_e', 'Block Lane'],

    ['rb', 's_1', 'South Road'], ['s_1', 's_2', 'South Road'], ['s_2', 'bt_e', 'South Road'],

    ['bt_e', 'fc', 'Bottom Road'], ['fc', 'bt_d', 'Bottom Road'], ['bt_d', 'bt_c', 'Bottom Road'],
    ['bt_c', 'bt_b', 'Bottom Road'], ['bt_b', 'bt_a', 'Bottom Road'], ['bt_a', 'bt_w', 'Bottom Road'],

    ['wst', 'w_1', 'West Road'], ['w_1', 'w_2', 'West Road'], ['w_2', 'sw', 'West Road'], ['sw', 'bt_w', 'West Road'],

    ['b1_top', 'b1', 'Block 1 Lane'], ['b1', 'b1_bot', 'Block 1 Lane'], ['b1_bot', 'sw', 'Block 1 Lane'],


    ['rb', 'se_1', 'Chitrakoot Road'], ['se_1', 'se_2', 'Chitrakoot Road'], ['se_2', 'se_3', 'Chitrakoot Road'],
    ['se_3', 'se_4', 'Chitrakoot Road'], ['se_4', 'se_5', 'Chitrakoot Road'],
    ['se_3', 'ch_w', 'Chitrakoot Road'], ['ch_w', 'ch_sw', 'Chitrakoot Road'], ['ch_sw', 'ch_se', 'Chitrakoot Road'],
    ['ch_se', 'ch_e', 'Chitrakoot Road'], ['ch_e', 'se_5', 'Chitrakoot Road'],

    ['se_2', 'b10_a', 'Block 10 Lane'], ['b10_a', 'b10_b', 'Block 10 Lane'],

    ['sp_mdc', 'bid_n', 'MDC Road'], ['bid_n', 'bid_s', 'Bidholi Road'], ['bid_s', 'gh', 'Girls Hostel Road']
  ],

  // Dashed outlines that group nearby places (closure + proximity)
  zones: [
    { id: 'academic', label: 'Academic core',  cx: 505, cy: 530, rx: 235, ry: 195, rot: -6 },
    { id: 'hostel',   label: 'Hostel zone',    cx: 752, cy: 470, rx: 105, ry: 115, rot: 0  },
    { id: 'south',    label: 'Blocks 10 & 11', cx: 775, cy: 655, rx: 125, ry: 85,  rot: 8, labelAt: 'bottom' }
  ],

  // Optional notices hook: e.g. [{ text: 'Temporary maintenance on West Road', blockedEdges: [['w_1', 'w_2']] }]
  // Shipped empty by default.
  notices: [],

  // Popular routes for quick selection
  popularRoutes: [
    { from: 'library', to: 'foodcourt', label: 'Library to Food Court' },
    { from: 'boys', to: 'b9', label: 'Boys Hostel to Block 9' },
    { from: 'b1', to: 'playground', label: 'Block 1 to PlayGround' },
    { from: 'girls', to: 'library', label: 'Girls Hostel to Library' },
    { from: 'foodcourt', to: 'b11', label: 'Food Court to Block 11' }
  ]
};

if (typeof module !== 'undefined') module.exports = CAMPUS;
