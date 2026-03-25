/**
 * Map drawing scenarios.
 *
 * Each scenario has a `passage` and an array of `questions`.
 * To add a scenario: append an object with the same shape.
 */

export const mapScenarios = [
  {
    passage: 'A rectangular 10-acre parcel runs east\u2013west along County Road 5. The owner\u2019s house sits in the northwest corner. A barn is located 200 feet directly south of the house. An irrigation canal runs along the entire southern boundary. Three monitoring traps (A, B, C) are placed at equal intervals along the northern fence line, starting from the northeast corner heading west.',
    questions: [
      { q: 'Where should the house be drawn on the map?',   correct: 'Northwest corner of the parcel',              wrong: ['Northeast corner', 'Center of the parcel', 'Southwest corner'],                   explanation: 'The passage says "northwest corner."' },
      { q: 'Where is the barn relative to the house?',      correct: '200 feet directly south of the house',        wrong: ['200 feet east of the house', 'Adjacent to the southern boundary', 'Center of parcel'], explanation: '"200 feet directly south of the house."' },
      { q: 'Trap A is located where?',                      correct: 'At the northeast corner of the parcel',       wrong: ['At the northwest corner', 'Midway along the northern fence', 'At the SE corner'],  explanation: 'Starting from the northeast corner heading west.' },
      { q: 'Where does the irrigation canal run?',          correct: 'Along the entire southern boundary',          wrong: ['Along the northern boundary', 'Through the center E\u2013W', 'Along the western boundary'], explanation: '"Along the entire southern boundary."' },
    ]
  },
  {
    passage: 'An L-shaped property borders Highway 99 on the east side. The north portion is a 5-acre walnut orchard in a grid pattern. The south portion extends west and contains a 2-acre tomato field. A well is located at the inside corner of the L, where the two portions meet. A dirt access road runs from Highway 99 westward along the boundary between the orchard and the tomato field. A storage shed is 50 feet west of the highway, on the north side of the access road.',
    questions: [
      { q: 'Which crop is in the northern portion?',  correct: 'Walnut orchard',                                                           wrong: ['Tomato field', 'Almond orchard', 'Vineyard'],                     explanation: '"North portion is a 5-acre walnut orchard."' },
      { q: 'Where is the well?',                      correct: 'At the inside corner of the L-shape where the two portions meet',           wrong: ['Center of the orchard', 'Along Highway 99', 'SW of the tomato field'], explanation: '"Inside corner of the L."' },
      { q: 'The access road runs in which direction?', correct: 'East\u2013west, from Highway 99 along the boundary between orchard and tomato field', wrong: ['N\u2013S through the orchard', 'Diagonally across', 'Along the southern boundary'], explanation: '"From Highway 99 westward along the boundary."' },
      { q: 'Where is the storage shed?',               correct: '50 feet west of Highway 99, on the north side of the access road',         wrong: ['Center of the tomato field', 'NW corner of the orchard', 'Adjacent to the well'], explanation: '"50 feet west of the highway, north side."' },
    ]
  },
  {
    passage: 'A triangular parcel sits at the intersection of Road A (running north\u2013south) and Road B (running northwest\u2013southeast). The third boundary is a creek running roughly east\u2013west along the south side. A farmhouse sits near the western vertex where Road A and the creek meet. An equipment yard is at the eastern vertex where Road B meets the creek. A pest monitoring station is at the northern vertex where Road A and Road B intersect.',
    questions: [
      { q: 'The farmhouse is at which vertex?',        correct: 'The western vertex where Road A and the creek meet', wrong: ['Northern vertex', 'Eastern vertex', 'Center of the triangle'], explanation: '"Western vertex where Road A and the creek meet."' },
      { q: 'Road B runs in which direction?',          correct: 'Northwest\u2013southeast',                          wrong: ['North\u2013south', 'East\u2013west', 'Northeast\u2013southwest'],     explanation: 'Passage specifies "northwest\u2013southeast."' },
      { q: 'Where is the pest monitoring station?',    correct: 'Northern vertex, where Road A and Road B intersect', wrong: ['Along the creek', 'Center of the parcel', 'Western vertex'],       explanation: '"Northern vertex where Road A and Road B intersect."' },
      { q: 'The creek forms which boundary?',          correct: 'The southern boundary, running roughly east\u2013west', wrong: ['Western boundary', 'Eastern boundary', 'Cuts through center'], explanation: '"Creek running roughly east\u2013west along the south side."' },
    ]
  },
  {
    passage: 'A 20-acre square parcel is divided into four equal quadrants by two perpendicular internal roads. The NW quadrant is a mature almond orchard. The NE quadrant is fallow ground. The SW quadrant has a packing shed in its center and a parking lot along its western edge. The SE quadrant is planted with young cherry trees. A windbreak row of tall pines runs along the entire northern boundary. The main gate is at the center of the southern boundary.',
    questions: [
      { q: 'Where are the cherry trees?',                       correct: 'SE quadrant',                        wrong: ['NE quadrant', 'NW quadrant', 'SW quadrant'],                          explanation: '"SE quadrant is planted with young cherry trees."' },
      { q: 'Where is the main gate?',                           correct: 'Center of the southern boundary',    wrong: ['Center of northern boundary', 'NW corner', 'Where roads cross'],      explanation: '"Main gate is at the center of the southern boundary."' },
      { q: 'The windbreak of pines is along which boundary?',   correct: 'The entire northern boundary',       wrong: ['Southern boundary', 'Western boundary', 'Along internal E\u2013W road'], explanation: '"Along the entire northern boundary."' },
      { q: 'What is in the NE quadrant?',                       correct: 'Fallow ground',                      wrong: ['Cherry trees', 'Almond orchard', 'Packing shed'],                     explanation: '"NE quadrant is fallow ground."' },
    ]
  },
];
