import type { Club, League } from "../types";

/**
 * Terceiro lote de competições reais (expansão mundial).
 * Mesmo formato dos catálogos anteriores.
 */
type Raw = [id: string, name: string, short: string, primary: string, secondary: string, strength: number];

const WAL: Raw[] = [
  ["wal_tns", "The New Saints", "TNS", "#0a5cb8", "#ffffff", 66],
  ["wal_con", "Connah's Quay Nomads", "CQN", "#111111", "#ffffff", 63],
  ["wal_pen", "Penybont", "PEN", "#f5c400", "#111111", 61],
  ["wal_bal", "Bala Town", "BAL", "#1f4fa0", "#ffffff", 60],
  ["wal_car", "Caernarfon Town", "CAE", "#c8102e", "#f5c400", 59],
  ["wal_hav", "Haverfordwest County", "HAV", "#1f4fa0", "#ffffff", 58],
  ["wal_abe", "Aberystwyth Town", "ABE", "#0a8f3c", "#111111", 57],
  ["wal_bar", "Barry Town United", "BAR", "#f5c400", "#0a8f3c", 58],
  ["wal_flint", "Flint Town United", "FLI", "#c8102e", "#ffffff", 56],
  ["wal_bri", "Briton Ferry Llansawel", "BRI", "#0a5cb8", "#111111", 55],
];

const MLT: Raw[] = [
  ["mlt_hib", "Hibernians", "HIB", "#111111", "#ffffff", 62],
  ["mlt_flo", "Floriana", "FLO", "#0a8f3c", "#ffffff", 61],
  ["mlt_val", "Valletta", "VAL", "#c8102e", "#111111", 61],
  ["mlt_bir", "Birkirkara", "BIR", "#c8102e", "#f5c400", 62],
  ["mlt_ham", "Ħamrun Spartans", "HAM", "#c8102e", "#111111", 63],
  ["mlt_gzi", "Gżira United", "GZI", "#1f4fa0", "#f5c400", 60],
  ["mlt_bal", "Balzan", "BAL", "#f5820a", "#111111", 58],
  ["mlt_sli", "Sliema Wanderers", "SLI", "#1f4fa0", "#ffffff", 59],
  ["mlt_mos", "Mosta", "MOS", "#c8102e", "#1f4fa0", 57],
  ["mlt_mar", "Marsaxlokk", "MAR", "#f5c400", "#111111", 56],
];

const LVA: Raw[] = [
  ["lva_rfs", "RFS", "RFS", "#7a1b30", "#ffffff", 68],
  ["lva_rig", "Riga FC", "RIG", "#111111", "#f5c400", 67],
  ["lva_val", "Valmiera", "VAL", "#0a8f3c", "#ffffff", 66],
  ["lva_lie", "Liepāja", "LIE", "#c8102e", "#ffffff", 63],
  ["lva_aus", "Auda", "AUD", "#1f4fa0", "#ffffff", 62],
  ["lva_spa", "Super Nova", "SUP", "#f5c400", "#111111", 60],
  ["lva_tuk", "Tukums 2000", "TUK", "#0a8f3c", "#f5c400", 58],
  ["lva_dau", "Daugavpils", "DAU", "#c8102e", "#111111", 57],
];

const LTU: Raw[] = [
  ["ltu_zal", "Žalgiris", "ZAL", "#0a8f3c", "#ffffff", 69],
  ["ltu_sud", "Sūduva", "SUD", "#1f4fa0", "#f5c400", 65],
  ["ltu_pan", "Panevėžys", "PAN", "#111111", "#f5c400", 66],
  ["ltu_kau", "Kauno Žalgiris", "KAU", "#0a8f3c", "#111111", 64],
  ["ltu_heg", "Hegelmann", "HEG", "#c8102e", "#ffffff", 62],
  ["ltu_ban", "Banga", "BAN", "#1f4fa0", "#ffffff", 60],
  ["ltu_dai", "Dainava", "DAI", "#f5820a", "#111111", 59],
  ["ltu_rie", "Riteriai", "RIT", "#7a1b30", "#f5c400", 58],
];

const EST: Raw[] = [
  ["est_flo", "Flora", "FLO", "#0a8f3c", "#ffffff", 67],
  ["est_lev", "Levadia", "LEV", "#0a8f3c", "#111111", 66],
  ["est_pai", "Paide Linnameeskond", "PAI", "#1f4fa0", "#ffffff", 63],
  ["est_nar", "Narva Trans", "NAR", "#c8102e", "#f5c400", 60],
  ["est_kal", "Kalju", "KAL", "#111111", "#0a8f3c", 62],
  ["est_kur", "Kuressaare", "KUR", "#1f4fa0", "#f5c400", 58],
  ["est_tam", "Tammeka", "TAM", "#0a8f3c", "#ffffff", 57],
  ["est_ves", "Vaprus", "VAP", "#c8102e", "#ffffff", 57],
];

const GEO: Raw[] = [
  ["geo_din", "Dinamo Tbilisi", "DIN", "#1f4fa0", "#ffffff", 69],
  ["geo_tor", "Torpedo Kutaisi", "TOR", "#f5c400", "#111111", 68],
  ["geo_din_bat", "Dinamo Batumi", "DBA", "#1f4fa0", "#f5c400", 68],
  ["geo_sab", "Saburtalo", "SAB", "#0a8f3c", "#ffffff", 66],
  ["geo_iber", "Iberia 1999", "IBE", "#c8102e", "#ffffff", 65],
  ["geo_kol", "Kolkheti Poti", "KOL", "#0a8f3c", "#f5c400", 61],
  ["geo_gag", "Gagra", "GAG", "#7a1b30", "#ffffff", 60],
  ["geo_sam", "Samgurali", "SAM", "#1f4fa0", "#c8102e", 62],
];

const ARM: Raw[] = [
  ["arm_pyu", "Pyunik", "PYU", "#f5c400", "#111111", 67],
  ["arm_ura", "Urartu", "URA", "#1f4fa0", "#ffffff", 65],
  ["arm_ala", "Ararat-Armenia", "ARA", "#c8102e", "#f5c400", 66],
  ["arm_noa", "Noah", "NOA", "#0a8f3c", "#ffffff", 65],
  ["arm_ale", "Alashkert", "ALA", "#7a1b30", "#ffffff", 63],
  ["arm_van", "Van", "VAN", "#1f4fa0", "#f5c400", 60],
  ["arm_shi", "Shirak", "SHI", "#c8102e", "#111111", 59],
  ["arm_bkm", "BKMA Yerevan", "BKM", "#111111", "#f5c400", 58],
];

const AZE: Raw[] = [
  ["aze_qar", "Qarabağ", "QAR", "#111111", "#ffffff", 74],
  ["aze_nef", "Neftçi", "NEF", "#111111", "#f5c400", 70],
  ["aze_zir", "Zira", "ZIR", "#1f4fa0", "#ffffff", 68],
  ["aze_sab", "Sabah", "SAB", "#0a8f3c", "#ffffff", 68],
  ["aze_sum", "Sumqayıt", "SUM", "#c8102e", "#111111", 65],
  ["aze_tur", "Turan Tovuz", "TUR", "#f5c400", "#1f4fa0", 64],
  ["aze_ara", "Araz-Naxçıvan", "ARA", "#c8102e", "#f5c400", 63],
  ["aze_kap", "Kəpəz", "KAP", "#0a8f3c", "#111111", 61],
];

const KAZ: Raw[] = [
  ["kaz_ast", "Astana", "AST", "#7ec8e3", "#f5c400", 71],
  ["kaz_kai", "Kairat", "KAI", "#f5c400", "#111111", 71],
  ["kaz_tob", "Tobol", "TOB", "#0a8f3c", "#ffffff", 69],
  ["kaz_ord", "Ordabasy", "ORD", "#1f4fa0", "#f5c400", 67],
  ["kaz_akt", "Aktobe", "AKT", "#c8102e", "#ffffff", 68],
  ["kaz_ata", "Atyrau", "ATY", "#1f4fa0", "#ffffff", 64],
  ["kaz_shak", "Shakhter Karagandy", "SHA", "#111111", "#f5820a", 64],
  ["kaz_tur", "Turan", "TRN", "#0a8f3c", "#f5c400", 61],
];

const UZB: Raw[] = [
  ["uzb_pak", "Pakhtakor", "PAK", "#1f4fa0", "#ffffff", 72],
  ["uzb_nas", "Nasaf", "NAS", "#0a8f3c", "#ffffff", 70],
  ["uzb_agmk", "AGMK", "AGM", "#f5820a", "#111111", 68],
  ["uzb_bun", "Bunyodkor", "BUN", "#7ec8e3", "#ffffff", 68],
  ["uzb_nav", "Navbahor", "NAV", "#0a8f3c", "#f5c400", 69],
  ["uzb_sog", "Sogdiana", "SOG", "#c8102e", "#ffffff", 65],
  ["uzb_and", "Andijon", "AND", "#1f4fa0", "#f5c400", 63],
  ["uzb_sur", "Surkhon", "SUR", "#f5c400", "#111111", 62],
];

const IRN: Raw[] = [
  ["irn_per", "Persepolis", "PER", "#c8102e", "#ffffff", 76],
  ["irn_est", "Esteghlal", "EST", "#1f4fa0", "#ffffff", 76],
  ["irn_sep", "Sepahan", "SEP", "#f5c400", "#111111", 75],
  ["irn_tra", "Tractor", "TRA", "#c8102e", "#111111", 74],
  ["irn_fou", "Foolad", "FOO", "#c8102e", "#f5c400", 72],
  ["irn_gol", "Gol Gohar", "GOL", "#0a8f3c", "#ffffff", 71],
  ["irn_mal", "Malavan", "MAL", "#1f4fa0", "#c8102e", 69],
  ["irn_zob", "Zob Ahan", "ZOB", "#0a8f3c", "#f5c400", 70],
];

const IRQ: Raw[] = [
  ["irq_shu", "Al-Shorta", "SHO", "#111111", "#ffffff", 72],
  ["irq_qiw", "Al-Quwa Al-Jawiya", "QAJ", "#1f4fa0", "#ffffff", 73],
  ["irq_zaw", "Al-Zawraa", "ZAW", "#f5c400", "#111111", 71],
  ["irq_tal", "Al-Talaba", "TAL", "#f5820a", "#111111", 68],
  ["irq_erb", "Erbil", "ERB", "#f5c400", "#0a8f3c", 67],
  ["irq_naf", "Naft Misan", "NAF", "#0a8f3c", "#ffffff", 65],
  ["irq_kar", "Karbalaa", "KAR", "#c8102e", "#ffffff", 66],
  ["irq_dho", "Duhok", "DUH", "#c8102e", "#f5c400", 66],
];

const JOR: Raw[] = [
  ["jor_wih", "Al-Wehdat", "WEH", "#0a8f3c", "#c8102e", 68],
  ["jor_fai", "Al-Faisaly", "FAI", "#1f4fa0", "#ffffff", 68],
  ["jor_hus", "Al-Hussein", "HUS", "#c8102e", "#ffffff", 65],
  ["jor_ram", "Al-Ramtha", "RAM", "#f5c400", "#111111", 63],
  ["jor_sal", "Al-Salt", "SAL", "#0a8f3c", "#ffffff", 62],
  ["jor_ahl", "Al-Ahli Amman", "AHL", "#c8102e", "#111111", 61],
  ["jor_jaz", "Al-Jazeera", "JAZ", "#1f4fa0", "#f5c400", 62],
  ["jor_shab", "Shabab Al-Ordon", "SHB", "#111111", "#f5c400", 61],
];

const KWT: Raw[] = [
  ["kwt_ara", "Al-Arabi", "ARA", "#0a8f3c", "#ffffff", 67],
  ["kwt_kuw", "Kuwait SC", "KUW", "#1f4fa0", "#f5c400", 70],
  ["kwt_qad", "Al-Qadsia", "QAD", "#f5c400", "#1f4fa0", 69],
  ["kwt_sal", "Al-Salmiya", "SAL", "#c8102e", "#ffffff", 65],
  ["kwt_jah", "Al-Jahra", "JAH", "#0a8f3c", "#f5c400", 62],
  ["kwt_nas", "Kazma", "KAZ", "#f5820a", "#111111", 63],
  ["kwt_fah", "Al-Fahaheel", "FAH", "#1f4fa0", "#ffffff", 61],
  ["kwt_yar", "Al-Yarmouk", "YAR", "#c8102e", "#111111", 60],
];

const OMN: Raw[] = [
  ["omn_sea", "Al-Seeb", "SEE", "#1f4fa0", "#ffffff", 66],
  ["omn_nah", "Al-Nahda", "NAH", "#f5820a", "#111111", 64],
  ["omn_dho", "Dhofar", "DHO", "#c8102e", "#ffffff", 65],
  ["omn_sur", "Sur", "SUR", "#0a8f3c", "#ffffff", 61],
  ["omn_sea2", "Seeb Club", "SEC", "#1f4fa0", "#f5c400", 60],
  ["omn_bah", "Bahla", "BAH", "#7a1b30", "#ffffff", 59],
  ["omn_ibr", "Ibri", "IBR", "#0a8f3c", "#f5c400", 58],
  ["omn_sohar", "Sohar", "SOH", "#c8102e", "#111111", 60],
];

const SGP: Raw[] = [
  ["sgp_lio", "Lion City Sailors", "LCS", "#1f4fa0", "#f5c400", 68],
  ["sgp_alb", "Albirex Niigata S", "ALB", "#7ec8e3", "#f5820a", 66],
  ["sgp_tam", "Tampines Rovers", "TAM", "#f5c400", "#111111", 65],
  ["sgp_bal", "Balestier Khalsa", "BAL", "#c8102e", "#f5c400", 60],
  ["sgp_gey", "Geylang International", "GEY", "#0a8f3c", "#ffffff", 61],
  ["sgp_hou", "Hougang United", "HOU", "#c8102e", "#111111", 62],
  ["sgp_you", "Young Lions", "YLI", "#c8102e", "#ffffff", 57],
  ["sgp_tan", "Tanjong Pagar United", "TPU", "#111111", "#f5c400", 58],
];

const HKG: Raw[] = [
  ["hkg_kit", "Kitchee", "KIT", "#1f4fa0", "#ffffff", 68],
  ["hkg_eas", "Eastern", "EAS", "#1f4fa0", "#c8102e", 66],
  ["hkg_lee", "Lee Man", "LEE", "#c8102e", "#111111", 65],
  ["hkg_sou", "Southern District", "SOU", "#0a8f3c", "#ffffff", 62],
  ["hkg_kow", "Kowloon City", "KOW", "#f5c400", "#111111", 59],
  ["hkg_res", "Resources Capital", "RES", "#7a1b30", "#f5c400", 61],
  ["hkg_tai", "Tai Po", "TAI", "#0a8f3c", "#f5c400", 62],
  ["hkg_hkr", "HK Rangers", "HKR", "#1f4fa0", "#f5c400", 58],
];

const PHI: Raw[] = [
  ["phi_kay", "Kaya FC", "KAY", "#c8102e", "#111111", 62],
  ["phi_uni", "United City", "UNC", "#1f4fa0", "#f5c400", 63],
  ["phi_sta", "Stallion Laguna", "STA", "#0a8f3c", "#ffffff", 59],
  ["phi_azk", "Azkals Development", "AZK", "#1f4fa0", "#ffffff", 57],
  ["phi_dyn", "Dynamic Herb Cebu", "CEB", "#f5820a", "#111111", 61],
  ["phi_mai", "Maharlika Manila", "MAH", "#f5c400", "#c8102e", 56],
  ["phi_men", "Mendiola", "MEN", "#7a1b30", "#ffffff", 56],
  ["phi_lok", "Loyola Meralco", "LOY", "#0a8f3c", "#f5c400", 55],
];

const NZL: Raw[] = [
  ["nzl_auc", "Auckland FC", "AUC", "#111111", "#7ec8e3", 70],
  ["nzl_wel", "Wellington Phoenix", "WEL", "#f5c400", "#111111", 69],
  ["nzl_aucu", "Auckland United", "AUU", "#1f4fa0", "#ffffff", 60],
  ["nzl_bir", "Birkenhead United", "BIR", "#c8102e", "#ffffff", 58],
  ["nzl_can", "Cashmere Technical", "CAS", "#0a8f3c", "#f5c400", 59],
  ["nzl_wai", "Waitakere City", "WAI", "#1f4fa0", "#f5c400", 57],
  ["nzl_chr", "Christchurch United", "CHR", "#c8102e", "#111111", 58],
  ["nzl_ham", "Hamilton Wanderers", "HAM", "#f5820a", "#111111", 56],
];

const CHI2: Raw[] = [
  ["chi2_san", "Santiago Wanderers", "SWA", "#0a8f3c", "#ffffff", 68],
  ["chi2_ran", "Rangers de Talca", "RAN", "#c8102e", "#111111", 65],
  ["chi2_sanl", "San Luis", "SLU", "#f5c400", "#111111", 64],
  ["chi2_mag", "Magallanes", "MAG", "#1f4fa0", "#f5c400", 67],
  ["chi2_uni", "San Marcos de Arica", "SMA", "#0a8f3c", "#f5c400", 62],
  ["chi2_ant", "Deportes Antofagasta", "ANT", "#7ec8e3", "#ffffff", 66],
  ["chi2_tem", "Deportes Temuco", "TEM", "#0a8f3c", "#ffffff", 65],
  ["chi2_con", "Deportes Concepción", "CON", "#7a1b30", "#f5c400", 63],
];

const URU2: Raw[] = [
  ["uru2_ram", "Rampla Juniors", "RAM", "#c8102e", "#0a8f3c", 62],
  ["uru2_cen", "Central Español", "CEN", "#c8102e", "#ffffff", 60],
  ["uru2_alb", "Albion", "ALB", "#7ec8e3", "#ffffff", 61],
  ["uru2_ova", "Rentistas", "REN", "#111111", "#f5c400", 63],
  ["uru2_uru", "Uruguay Montevideo", "URU", "#1f4fa0", "#ffffff", 59],
  ["uru2_ata", "Atenas", "ATE", "#c8102e", "#111111", 58],
  ["uru2_tac", "Tacuarembó", "TAC", "#0a8f3c", "#ffffff", 58],
  ["uru2_pro", "Progreso", "PRO", "#c8102e", "#f5c400", 62],
];

const COL2: Raw[] = [
  ["col2_qui", "Deportes Quindío", "QUI", "#c8102e", "#f5c400", 63],
  ["col2_cuc", "Cúcuta Deportivo", "CUC", "#c8102e", "#111111", 65],
  ["col2_rea", "Real Cartagena", "RCA", "#0a8f3c", "#f5c400", 64],
  ["col2_orso", "Orsomarso", "ORS", "#0a8f3c", "#ffffff", 60],
  ["col2_bog", "Bogotá FC", "BOG", "#1f4fa0", "#ffffff", 59],
  ["col2_tig", "Tigres FC", "TIG", "#f5c400", "#111111", 60],
  ["col2_lla", "Llaneros", "LLA", "#0a8f3c", "#f5c400", 62],
  ["col2_bar", "Barranquilla FC", "BFC", "#c8102e", "#ffffff", 61],
];

const PAN: Raw[] = [
  ["pan_taur", "Tauro", "TAU", "#f5820a", "#111111", 64],
  ["pan_pla", "Plaza Amador", "PLA", "#c8102e", "#111111", 65],
  ["pan_ind", "Independiente", "IND", "#0a8f3c", "#ffffff", 63],
  ["pan_her", "Herrera", "HER", "#1f4fa0", "#f5c400", 60],
  ["pan_ari", "Árabe Unido", "ARA", "#c8102e", "#f5c400", 62],
  ["pan_cai", "Sporting San Miguelito", "SSM", "#0a8f3c", "#f5c400", 61],
  ["pan_umecit", "Umecit", "UME", "#1f4fa0", "#ffffff", 59],
  ["pan_ver", "Veraguas", "VER", "#7a1b30", "#ffffff", 58],
];

const GUA: Raw[] = [
  ["gua_com", "Comunicaciones", "COM", "#ffffff", "#1f4fa0", 66],
  ["gua_mun", "Municipal", "MUN", "#c8102e", "#ffffff", 66],
  ["gua_ant", "Antigua GFC", "ANT", "#0a8f3c", "#ffffff", 64],
  ["gua_xel", "Xelajú MC", "XEL", "#7ec8e3", "#ffffff", 64],
  ["gua_coa", "Cobán Imperial", "COB", "#f5c400", "#111111", 62],
  ["gua_mix", "Mixco", "MIX", "#0a8f3c", "#f5c400", 61],
  ["gua_gua", "Guastatoya", "GUA", "#c8102e", "#f5c400", 62],
  ["gua_mal", "Malacateco", "MAL", "#1f4fa0", "#f5c400", 60],
];

const HON: Raw[] = [
  ["hon_olim", "Olimpia", "OLI", "#ffffff", "#111111", 68],
  ["hon_mot", "Motagua", "MOT", "#1f4fa0", "#ffffff", 67],
  ["hon_mar", "Marathón", "MAR", "#0a8f3c", "#ffffff", 65],
  ["hon_rea", "Real España", "RES", "#c8102e", "#f5c400", 65],
  ["hon_vic", "Victoria", "VIC", "#7a1b30", "#ffffff", 61],
  ["hon_gen", "Génesis", "GEN", "#0a8f3c", "#f5c400", 60],
  ["hon_jua", "Juticalpa", "JUT", "#f5820a", "#111111", 59],
  ["hon_pot", "Potros Olancho", "OLA", "#c8102e", "#111111", 62],
];

const JAM: Raw[] = [
  ["jam_cav", "Cavalier", "CAV", "#f5c400", "#111111", 62],
  ["jam_mou", "Mount Pleasant", "MPL", "#0a8f3c", "#f5c400", 63],
  ["jam_ara", "Arnett Gardens", "ARN", "#0a8f3c", "#c8102e", 62],
  ["jam_por", "Portmore United", "POR", "#1f4fa0", "#f5c400", 61],
  ["jam_har", "Harbour View", "HAR", "#1f4fa0", "#ffffff", 60],
  ["jam_wat", "Waterhouse", "WAT", "#f5c400", "#1f4fa0", 61],
  ["jam_dun", "Dunbeholden", "DUN", "#c8102e", "#ffffff", 58],
  ["jam_tiv", "Tivoli Gardens", "TIV", "#0a8f3c", "#f5c400", 59],
];

const CIV: Raw[] = [
  ["civ_asec", "ASEC Mimosas", "ASE", "#f5c400", "#111111", 70],
  ["civ_afr", "Africa Sports", "AFR", "#c8102e", "#ffffff", 67],
  ["civ_sew", "Séwé Sport", "SEW", "#0a8f3c", "#ffffff", 65],
  ["civ_stad", "Stade d'Abidjan", "STA", "#c8102e", "#f5c400", 64],
  ["civ_san", "SOL FC", "SOL", "#1f4fa0", "#ffffff", 62],
  ["civ_bou", "Bouaké FC", "BOU", "#f5820a", "#111111", 61],
  ["civ_spo", "Sporting Gagnoa", "GAG", "#0a8f3c", "#f5c400", 63],
  ["civ_man", "Mancini FC", "MAN", "#7a1b30", "#ffffff", 60],
];

const SEN: Raw[] = [
  ["sen_gen", "Génération Foot", "GEN", "#0a8f3c", "#f5c400", 68],
  ["sen_jar", "Jaraaf", "JAR", "#0a8f3c", "#ffffff", 67],
  ["sen_tei", "Teungueth FC", "TEU", "#1f4fa0", "#ffffff", 68],
  ["sen_cas", "Casa Sports", "CAS", "#0a8f3c", "#c8102e", 66],
  ["sen_dio", "Diambars", "DIA", "#7ec8e3", "#ffffff", 65],
  ["sen_gui", "Guédiawaye FC", "GUE", "#f5c400", "#111111", 63],
  ["sen_dak", "AS Douanes", "DOU", "#c8102e", "#f5c400", 64],
  ["sen_pik", "Pikine", "PIK", "#1f4fa0", "#f5c400", 62],
];

const CMR: Raw[] = [
  ["cmr_coton", "Coton Sport", "COT", "#f5c400", "#0a8f3c", 69],
  ["cmr_uds", "UMS de Loum", "UMS", "#1f4fa0", "#ffffff", 64],
  ["cmr_can", "Canon Yaoundé", "CAN", "#c8102e", "#f5c400", 66],
  ["cmr_ton", "Tonnerre Yaoundé", "TON", "#f5c400", "#111111", 64],
  ["cmr_pwd", "PWD Bamenda", "PWD", "#0a8f3c", "#ffffff", 65],
  ["cmr_vic", "Victoria United", "VIC", "#1f4fa0", "#f5c400", 66],
  ["cmr_dyn", "Dynamo Douala", "DYN", "#c8102e", "#ffffff", 62],
  ["cmr_apejes", "Apejes", "APE", "#0a8f3c", "#f5c400", 61],
];

const COD: Raw[] = [
  ["cod_maz", "TP Mazembe", "MAZ", "#111111", "#ffffff", 74],
  ["cod_vit", "AS Vita Club", "VIT", "#0a8f3c", "#ffffff", 71],
  ["cod_mai", "DC Motema Pembe", "DCMP", "#1f4fa0", "#f5c400", 69],
  ["cod_lup", "Lupopo", "LUP", "#7ec8e3", "#ffffff", 68],
  ["cod_san", "Sanga Balende", "SAN", "#c8102e", "#f5c400", 65],
  ["cod_don", "Don Bosco", "DON", "#0a8f3c", "#f5c400", 66],
  ["cod_mak", "Maniema Union", "MAN", "#f5820a", "#111111", 64],
  ["cod_ren", "Renaissance du Congo", "REN", "#1f4fa0", "#ffffff", 63],
];

const ZAM: Raw[] = [
  ["zam_pow", "Power Dynamos", "POW", "#c8102e", "#ffffff", 66],
  ["zam_zes", "ZESCO United", "ZES", "#f5820a", "#111111", 67],
  ["zam_nka", "Nkana", "NKA", "#c8102e", "#111111", 65],
  ["zam_red", "Red Arrows", "ARR", "#c8102e", "#f5c400", 64],
  ["zam_gre", "Green Eagles", "GRE", "#0a8f3c", "#ffffff", 64],
  ["zam_for", "Forest Rangers", "FOR", "#0a8f3c", "#f5c400", 62],
  ["zam_zan", "Zanaco", "ZAN", "#0a8f3c", "#111111", 65],
  ["zam_kab", "Kabwe Warriors", "KAB", "#1f4fa0", "#ffffff", 61],
];

const BLR: Raw[] = [
  ["blr_bat", "BATE Borisov", "BAT", "#f5c400", "#1f4fa0", 69],
  ["blr_din", "Dinamo Minsk", "DMI", "#1f4fa0", "#ffffff", 70],
  ["blr_sha", "Shakhtyor Soligorsk", "SHA", "#c8102e", "#111111", 69],
  ["blr_ise", "Isloch", "ISL", "#0a8f3c", "#ffffff", 65],
  ["blr_neman", "Neman Grodno", "NEM", "#0a8f3c", "#f5c400", 66],
  ["blr_gom", "Gomel", "GOM", "#c8102e", "#f5c400", 64],
  ["blr_tor", "Torpedo Zhodino", "TOR", "#1f4fa0", "#f5c400", 65],
  ["blr_slavia", "Slavia Mozyr", "SLA", "#111111", "#ffffff", 63],
];

const ALB: Raw[] = [
  ["alb_tir", "KF Tirana", "TIR", "#1f4fa0", "#ffffff", 66],
  ["alb_par", "Partizani", "PAR", "#c8102e", "#111111", 66],
  ["alb_din", "Dinamo Tirana", "DIN", "#1f4fa0", "#c8102e", 64],
  ["alb_vll", "Vllaznia", "VLL", "#1f4fa0", "#ffffff", 65],
  ["alb_lac", "Laçi", "LAC", "#0a8f3c", "#ffffff", 64],
  ["alb_egn", "Egnatia", "EGN", "#f5c400", "#111111", 66],
  ["alb_ska", "Skënderbeu", "SKE", "#c8102e", "#f5c400", 63],
  ["alb_teu", "Teuta", "TEU", "#1f4fa0", "#f5c400", 62],
];

const MKD: Raw[] = [
  ["mkd_shk", "Shkëndija", "SHK", "#c8102e", "#111111", 67],
  ["mkd_var", "Vardar", "VAR", "#c8102e", "#111111", 64],
  ["mkd_str", "Struga", "STR", "#7ec8e3", "#ffffff", 66],
  ["mkd_ska", "Rabotnicki", "RAB", "#c8102e", "#f5c400", 63],
  ["mkd_aka", "Akademija Pandev", "AKA", "#0a8f3c", "#ffffff", 63],
  ["mkd_bre", "Bregalnica", "BRE", "#1f4fa0", "#ffffff", 60],
  ["mkd_mak", "Makedonija GP", "MGP", "#c8102e", "#f5c400", 61],
  ["mkd_sil", "Sileks", "SIL", "#f5c400", "#111111", 61],
];

const BIH: Raw[] = [
  ["bih_zel", "Željezničar", "ZEL", "#1f4fa0", "#ffffff", 67],
  ["bih_sar", "Sarajevo", "SAR", "#7a1b30", "#ffffff", 68],
  ["bih_zri", "Zrinjski Mostar", "ZRI", "#c8102e", "#ffffff", 69],
  ["bih_bor", "Borac Banja Luka", "BOR", "#c8102e", "#1f4fa0", 69],
  ["bih_vel", "Velež Mostar", "VEL", "#c8102e", "#111111", 65],
  ["bih_shi", "Široki Brijeg", "SIR", "#c8102e", "#f5c400", 65],
  ["bih_tuz", "Tuzla City", "TUZ", "#1f4fa0", "#f5c400", 63],
  ["bih_slo", "Sloboda Tuzla", "SLO", "#c8102e", "#ffffff", 62],
];

const MNE: Raw[] = [
  ["mne_bud", "Budućnost", "BUD", "#1f4fa0", "#ffffff", 65],
  ["mne_sut", "Sutjeska", "SUT", "#1f4fa0", "#f5c400", 64],
  ["mne_dec", "Dečić", "DEC", "#c8102e", "#111111", 62],
  ["mne_jez", "Jezero", "JEZ", "#0a8f3c", "#ffffff", 60],
  ["mne_arse", "Arsenal Tivat", "ARS", "#c8102e", "#f5c400", 60],
  ["mne_pet", "Petrovac", "PET", "#f5c400", "#111111", 61],
  ["mne_mor", "Mornar", "MOR", "#1f4fa0", "#ffffff", 62],
  ["mne_rud", "Rudar Pljevlja", "RUD", "#111111", "#f5c400", 61],
];

function build(id: string, name: string, country: string, flag: string, raw: Raw[]): League {
  const clubs: Club[] = raw.map(([cid, cname, short, primary, secondary, strength]) => ({
    id: cid,
    name: cname,
    short,
    league: id,
    primary,
    secondary,
    strength,
  }));
  return { id, name, country, flag, clubs };
}

export const WORLD_LEAGUES: League[] = [
  build("wal", "Cymru Premier", "País de Gales", "🏴󠁧󠁢󠁷󠁬󠁳󠁿", WAL),
  build("mlt", "Premier League Maltesa", "Malta", "🇲🇹", MLT),
  build("lva", "Virsliga", "Letônia", "🇱🇻", LVA),
  build("ltu", "A Lyga", "Lituânia", "🇱🇹", LTU),
  build("est", "Meistriliiga", "Estônia", "🇪🇪", EST),
  build("geo", "Erovnuli Liga", "Geórgia", "🇬🇪", GEO),
  build("arm", "Premier League Armênia", "Armênia", "🇦🇲", ARM),
  build("aze", "Premyer Liqa", "Azerbaijão", "🇦🇿", AZE),
  build("kaz", "Premier League Cazaque", "Cazaquistão", "🇰🇿", KAZ),
  build("uzb", "Superliga", "Uzbequistão", "🇺🇿", UZB),
  build("irn", "Persian Gulf Pro League", "Irã", "🇮🇷", IRN),
  build("irq", "Stars League Iraquiana", "Iraque", "🇮🇶", IRQ),
  build("jor", "Pro League Jordaniana", "Jordânia", "🇯🇴", JOR),
  build("kwt", "Premier League Kuwaitiana", "Kuwait", "🇰🇼", KWT),
  build("omn", "Professional League", "Omã", "🇴🇲", OMN),
  build("sgp", "Singapore Premier League", "Singapura", "🇸🇬", SGP),
  build("hkg", "Hong Kong Premier League", "Hong Kong", "🇭🇰", HKG),
  build("phi", "Philippines Football League", "Filipinas", "🇵🇭", PHI),
  build("nzl", "New Zealand National League", "Nova Zelândia", "🇳🇿", NZL),
  build("chi2", "Primera B", "Chile", "🇨🇱", CHI2),
  build("uru2", "Segunda División", "Uruguai", "🇺🇾", URU2),
  build("col2", "Torneo BetPlay", "Colômbia", "🇨🇴", COL2),
  build("pan", "Liga Panameña", "Panamá", "🇵🇦", PAN),
  build("gua", "Liga Nacional", "Guatemala", "🇬🇹", GUA),
  build("hon", "Liga Nacional", "Honduras", "🇭🇳", HON),
  build("jam", "Jamaica Premier League", "Jamaica", "🇯🇲", JAM),
  build("civ", "Ligue 1 Marfinense", "Costa do Marfim", "🇨🇮", CIV),
  build("sen", "Ligue 1 Senegalesa", "Senegal", "🇸🇳", SEN),
  build("cmr", "Elite One", "Camarões", "🇨🇲", CMR),
  build("cod", "Linafoot", "RD Congo", "🇨🇩", COD),
  build("zam", "Super League Zambiana", "Zâmbia", "🇿🇲", ZAM),
  build("blr", "Vysheyshaya Liga", "Belarus", "🇧🇾", BLR),
  build("alb", "Kategoria Superiore", "Albânia", "🇦🇱", ALB),
  build("mkd", "Prva Liga", "Macedônia do Norte", "🇲🇰", MKD),
  build("bih", "Premijer Liga", "Bósnia e Herzegovina", "🇧🇦", BIH),
  build("mne", "Prva CFL", "Montenegro", "🇲🇪", MNE),
];
