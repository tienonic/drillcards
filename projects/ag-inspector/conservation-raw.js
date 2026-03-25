/**
 * Conservation & protected species data for Sacramento County.
 *
 * Each species has: name, scientific, status, habitat, id_features,
 * inspector_action, distinguish.
 *
 * Questions are auto-generated from this data.
 * To add a species: append an object with the same shape.
 */

export const conservationSpecies = [
  {
    name:             'Valley Elderberry',
    scientific:       'Sambucus nigra ssp. caerulea',
    status:           'Protected as habitat for Federally Threatened Valley Elderberry Longhorn Beetle (VELB)',
    habitat:          'Riparian areas and stream banks throughout the Central Valley',
    id_features:      'Large deciduous shrub/small tree (6\u201330 ft). Opposite compound leaves with 5\u20137 serrated leaflets. Flat-topped clusters of tiny cream-white flowers. Blue-black berries with white waxy coating.',
    inspector_action: 'Do not disturb stems >1 inch diameter. Report if within 100 ft of ground disturbance. No trimming March\u2013July (beetle flight season).',
    distinguish:      'Blue berries (vs red elderberry S. racemosa). Opposite compound leaves. Pithy stems when cut.',
  },
  {
    name:             'Valley Oak',
    scientific:       'Quercus lobata',
    status:           'Protected under Sacramento County Heritage Tree Ordinance (>12 inch trunk diameter)',
    habitat:          'Valley floors, riparian corridors, deep alluvial soils in the Central Valley',
    id_features:      'Largest North American oak (up to 100 ft). Deeply lobed rounded leaves (6\u201312 lobes). Thick, deeply furrowed gray-brown bark. Elongated acorns (1\u20132 inches) in shallow cup.',
    inspector_action: 'Heritage trees (>12" DBH) require permit before removal or major pruning. Document and report unauthorized cutting.',
    distinguish:      'Deeper lobes than blue oak. Much larger tree than interior live oak. Deciduous (vs evergreen live oaks).',
  },
  {
    name:             'Sacramento Orcutt Grass',
    scientific:       'Orcuttia viscida',
    status:           'Federally Endangered, CA State Endangered. Found ONLY in Sacramento County vernal pools.',
    habitat:          'Vernal pools \u2014 seasonal wetlands that fill with rain and dry by summer',
    id_features:      'Small annual grass (2\u20136 inches). Sticky/viscid stems and leaves. Grows in rings around drying vernal pool margins. Gray-green color, often in mats.',
    inspector_action: 'Never enter vernal pool habitat during growing season (spring). Report any grading or fill activity near known pools to USFWS.',
    distinguish:      'Sticky feel (viscid). Ring pattern around drying pools. Very small stature vs other grasses.',
  },
  {
    name:             'Boggs Lake Hedge-Hyssop',
    scientific:       'Gratiola heterosepala',
    status:           'CA State Endangered, CNPS Rank 1B.2 (rare, threatened, endangered)',
    habitat:          'Margins of vernal pools, seasonal lakes, and shallow wetlands on clay soils',
    id_features:      'Small annual herb (2\u20138 inches). Opposite, clasping leaves (no stalks). Yellow tubular flowers. Grows in muddy pool margins as water recedes.',
    inspector_action: 'Avoid disturbing vernal pool margins. Report observations to CDFW for tracking.',
    distinguish:      'Yellow flowers (most hedge-hyssops are white/purple). Opposite clasping leaves. Wet clay habitat.',
  },
  {
    name:             'Sanford\u2019s Arrowhead',
    scientific:       'Sagittaria sanfordii',
    status:           'CNPS Rank 1B.2 (rare, threatened, endangered in CA)',
    habitat:          'Shallow freshwater marshes, ponds, ditches, and slow streams in the Central Valley',
    id_features:      'Emergent aquatic perennial (1\u20133 ft). Arrow-shaped (sagittate) leaves rising from water. White 3-petaled flowers in whorls on tall stalks.',
    inspector_action: 'Avoid draining or filling occupied waterways. Document during site inspections near water features.',
    distinguish:      'Distinctly arrow-shaped leaves. Aquatic habit. White 3-petaled flowers.',
  },
  {
    name:             'Giant Garter Snake Habitat Plants',
    scientific:       'Schoenoplectus acutus / Typha spp.',
    status:           'Habitat for Federally Threatened Giant Garter Snake (Thamnophis gigas)',
    habitat:          'Marshes, rice fields, irrigation canals, and drainage ditches in the Central Valley',
    id_features:      'Tule (S. acutus): tall cylindrical stems 6\u201310 ft, triangular cross-section. Cattail (Typha): flat strap-like leaves, brown cylindrical seed head.',
    inspector_action: 'Report construction near occupied waterways. No canal clearing Oct\u2013Apr (snake hibernation). Consult USFWS before water management changes.',
    distinguish:      'Tule: round/triangular hollow stems. Cattail: flat leaves + brown seed spike. Both are wetland emergent plants.',
  },
];
