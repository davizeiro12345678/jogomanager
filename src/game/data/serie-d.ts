/** CBF, Série D 2026: 16 groups of six clubs, not the old three partial lists. */
export const SERIE_D_IDS = Array.from(
  { length: 16 },
  (_, i) => `y5079${String.fromCharCode(97 + i)}`,
);
export const SERIE_D_SOURCE =
  "https://www.cbf.com.br/futebol-brasileiro/noticias/selecao-masculina/comunicado-1/cbf-divulga-grupos-da-serie-d-de-2026";
export const SERIE_D_GROUPS: string[][] = [
  ["Nacional-AM", "Manaus-AM", "Manauara-AM", "GAS-RR", "Monte Roraima-RR", "São Raimundo-RR"],
  ["Independência-AC", "Galvez-AC", "Humaitá-AC", "Porto Velho-RO", "Guaporé-RO", "Araguaína-TO"],
  ["Gama-DF", "Brasiliense-DF", "Luverdense-MT", "Primavera-MT", "Inhumas-GO", "Aparecidense-GO"],
  ["Capital-DF", "Ceilândia-DF", "Mixto-MT", "Operário-MT", "União-MT", "Goiatuba-GO"],
  [
    "Trem-AP",
    "Oratório-AP",
    "Tuna Luso-PA",
    "Águia de Marabá-PA",
    "Tocantinópolis-TO",
    "Imperatriz-MA",
  ],
  ["Sampaio Corrêa-MA", "Moto Club-MA", "IAPE-MA", "Maracanã-CE", "Iguatu-CE", "Parnahyba-PI"],
  ["Ferroviário-CE", "Tirol-CE", "Atlético-CE", "Altos-PI", "Piauí-PI", "Fluminense-PI"],
  ["ABC-RN", "América-RN", "Laguna-RN", "Sousa-PB", "Maguary-PE", "Central-PE"],
  ["Retrô-PE", "Decisão-PE", "Serra Branca-PB", "Treze-PB", "Lagarto-SE", "Sergipe-SE"],
  ["ASA-AL", "CSA-AL", "CSE-AL", "Jacuipense-BA", "Atlético-BA", "Juazeirense-BA"],
  ["Uberlândia-MG", "Betim-MG", "CRAC-GO", "ABECAT-GO", "Operário-MS", "Ivinhema-MS"],
  ["Porto-BA", "Rio Branco-ES", "Vitória-ES", "Real Noroeste-ES", "Tombense-MG", "Democrata GV-MG"],
  [
    "Madureira-RJ",
    "Portuguesa-RJ",
    "America-RJ",
    "Portuguesa-SP",
    "Água Santa-SP",
    "Pouso Alegre-MG",
  ],
  [
    "Nova Iguaçu-RJ",
    "Sampaio Corrêa-RJ",
    "Maricá-RJ",
    "XV de Piracicaba-SP",
    "Noroeste-SP",
    "Velo Clube-SP",
  ],
  [
    "Cianorte-PR",
    "FC Cascavel-PR",
    "Santa Catarina-SC",
    "Joinville-SC",
    "Guarany de Bagé-RS",
    "São Luiz-RS",
  ],
  [
    "Blumenau-SC",
    "Marcílio Dias-SC",
    "São Joseense-PR",
    "Azuriz-PR",
    "São José-RS",
    "Brasil de Pelotas-RS",
  ],
];
