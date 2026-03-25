/**
 * Curated glossary terms for the Term Definer panel.
 *
 * Additional terms are auto-extracted from crop and conservation data at runtime.
 * User-added terms are stored in localStorage separately.
 *
 * To add a term: append { term, def } to this array.
 */

export const curatedTerms = [
  { term: 'Phytosanitary Certificate',              def: 'Official document certifying plants/products are pest-free, meeting import requirements.' },
  { term: 'CPC (Certified Producer\'s Certificate)', def: 'CA certificate verifying a farmer grew the produce sold at certified farmers\' markets.' },
  { term: 'County Agricultural Commissioner',        def: 'County official enforcing ag laws, overseeing inspections, and managing pest prevention.' },
  { term: 'Pest Detection Survey',                   def: 'Systematic inspection using traps/monitoring to detect target pests in an area.' },
  { term: 'Quarantine',                              def: 'Legal restriction on movement of plants/products to prevent pest/disease spread.' },
  { term: 'Host Range',                              def: 'The variety of plant species a pest or pathogen can infect or feed on.' },
  { term: 'Eradication',                             def: 'Complete elimination of a pest population from a defined area.' },
  { term: 'Containment',                             def: 'Actions to prevent a pest from spreading beyond a defined area.' },
  { term: 'IPM (Integrated Pest Management)',         def: 'Sustainable approach combining biological, cultural, physical, and chemical pest management.' },
  { term: 'Biological Control',                      def: 'Using natural enemies (predators, parasitoids, pathogens) to suppress pest populations.' },
  { term: 'Economic Threshold',                      def: 'Pest level at which control action should be taken to prevent economic damage.' },
  { term: 'Nursery Stock',                           def: 'Plants grown/imported into a nursery for propagation or sale, subject to inspection.' },
  { term: 'Budwood',                                 def: 'Vegetative buds taken from a source tree for grafting onto rootstock.' },
  { term: 'Rootstock',                               def: 'Root system onto which a scion is grafted; selected for disease resistance or vigor.' },
  { term: 'Scion',                                   def: 'Upper grafted portion determining fruit variety.' },
  { term: 'Right of Entry',                          def: 'Legal authority for inspectors to enter private property for agricultural inspection.' },
  { term: 'Abatement Notice',                        def: 'Official order to remove/treat a pest or nuisance within a set time.' },
  { term: 'Hold Order',                              def: 'Legal directive preventing movement/sale of ag products pending inspection.' },
  { term: 'Compliance Agreement',                    def: 'Written agreement outlining pest prevention measures a business will follow.' },
  { term: 'Shall (legal)',                           def: 'Mandatory requirement in regulatory text. The action must be performed.' },
  { term: 'Must (legal)',                            def: 'Mandatory requirement, same weight as "shall."' },
  { term: 'May (legal)',                             def: 'Permitted but not required. Discretionary action.' },
  { term: 'Should (legal)',                          def: 'Recommended but not mandatory. Best practice.' },
  { term: 'Vernal Pool',                             def: 'Seasonal wetland that fills with rain and dries in summer. Habitat for rare species.' },
  { term: 'Riparian',                                def: 'Relating to the banks of a river or stream. Riparian habitat is often protected.' },
  { term: 'ESA (Endangered Species Act)',             def: 'Federal law protecting threatened and endangered species and their habitats.' },
  { term: 'CESA (CA Endangered Species Act)',         def: 'California state law providing additional protections for listed species.' },
  { term: 'Critical Habitat',                        def: 'Areas designated as essential for the conservation of a listed species.' },
];
