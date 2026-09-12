import type { Club, League } from "../types";

/**
 * Ligas adicionais (expansão do mundo do jogo).
 * Mesmo formato do catálogo principal.
 */
type Raw = [
  id: string,
  name: string,
  short: string,
  primary: string,
  secondary: string,
  strength: number,
];

const RUS: Raw[] = [
  ["rus_zen", "Zenit", "ZEN", "#0a5cb8", "#8ec63f", 79],
  ["rus_spa", "Spartak Moscou", "SPA", "#c8102e", "#ffffff", 77],
  ["rus_csk", "CSKA Moscou", "CSK", "#1f3f95", "#c8102e", 77],
  ["rus_din", "Dínamo Moscou", "DIN", "#1f4fa0", "#ffffff", 75],
  ["rus_kra", "Krasnodar", "KRA", "#0a8f3c", "#111111", 76],
  ["rus_loc", "Lokomotiv Moscou", "LOK", "#0a8f3c", "#c8102e", 75],
  ["rus_rub", "Rubin Kazan", "RUB", "#8f1f2f", "#0a8f3c", 72],
  ["rus_ros", "Rostov", "ROS", "#f5c400", "#1f4fa0", 71],
  ["rus_sam", "Krylia Sovetov", "KRY", "#1f4fa0", "#7ec8e3", 70],
  ["rus_akh", "Akhmat Grozny", "AKH", "#0a8f3c", "#ffffff", 70],
  ["rus_ura", "Ural", "URA", "#f5820a", "#111111", 69],
  ["rus_sochi", "Sochi", "SOC", "#111111", "#7ec8e3", 68],
];

const ISR: Raw[] = [
  ["isr_mha", "Maccabi Haifa", "MHA", "#0a8f3c", "#ffffff", 74],
  ["isr_mtl", "Maccabi Tel Aviv", "MTA", "#f5c400", "#1f4fa0", 75],
  ["isr_hbs", "Hapoel Be'er Sheva", "HBS", "#c8102e", "#ffffff", 73],
  ["isr_hte", "Hapoel Tel Aviv", "HTA", "#c8102e", "#ffffff", 70],
  ["isr_bei", "Beitar Jerusalém", "BEI", "#f5c400", "#111111", 70],
  ["isr_mne", "Maccabi Netanya", "MNE", "#f5c400", "#111111", 68],
  ["isr_bnei", "Bnei Sakhnin", "BNS", "#c8102e", "#ffffff", 66],
  ["isr_asd", "Maccabi Bnei Raina", "MBR", "#0a8f3c", "#ffffff", 65],
  ["isr_had", "Hapoel Hadera", "HAD", "#1f4fa0", "#ffffff", 65],
  ["isr_ash", "FC Ashdod", "ASH", "#c8102e", "#f5c400", 66],
];

const HUN: Raw[] = [
  ["hun_fer", "Ferencváros", "FER", "#0a8f3c", "#ffffff", 74],
  ["hun_pak", "Paksi", "PAK", "#0a8f3c", "#f5c400", 68],
  ["hun_fev", "Fehérvár", "FEV", "#c8102e", "#1f4fa0", 69],
  ["hun_pus", "Puskás Akadémia", "PUS", "#1f4fa0", "#f5c400", 70],
  ["hun_deb", "Debrecen", "DEB", "#c8102e", "#ffffff", 68],
  ["hun_uje", "Újpest", "UJP", "#5b2d8e", "#ffffff", 67],
  ["hun_mtk", "MTK Budapest", "MTK", "#1f4fa0", "#ffffff", 66],
  ["hun_kis", "Kisvárda", "KIS", "#f5c400", "#111111", 65],
  ["hun_zte", "ZTE", "ZTE", "#1f4fa0", "#ffffff", 65],
  ["hun_gyo", "Győr ETO", "ETO", "#0a8f3c", "#ffffff", 66],
];

const BUL: Raw[] = [
  ["bul_lud", "Ludogorets", "LUD", "#0a8f3c", "#ffffff", 73],
  ["bul_csk", "CSKA Sofia", "CSK", "#c8102e", "#111111", 70],
  ["bul_lev", "Levski Sofia", "LEV", "#1f4fa0", "#ffffff", 70],
  ["bul_lok", "Lokomotiv Plovdiv", "LOK", "#111111", "#7ec8e3", 68],
  ["bul_bot", "Botev Plovdiv", "BOT", "#f5c400", "#111111", 66],
  ["bul_ars", "Arda", "ARD", "#c8102e", "#ffffff", 65],
  ["bul_cher", "Cherno More", "CHE", "#1f4fa0", "#ffffff", 65],
  ["bul_sla", "Slavia Sofia", "SLA", "#ffffff", "#111111", 64],
];

const SVK: Raw[] = [
  ["svk_slo", "Slovan Bratislava", "SLO", "#7ec8e3", "#ffffff", 72],
  ["svk_spa", "Spartak Trnava", "TRN", "#c8102e", "#111111", 69],
  ["svk_zil", "MŠK Žilina", "ZIL", "#f5c400", "#0a8f3c", 68],
  ["svk_dun", "DAC Dunajská Streda", "DAC", "#f5c400", "#1f4fa0", 68],
  ["svk_ruz", "Ružomberok", "RUZ", "#c8102e", "#ffffff", 65],
  ["svk_pod", "Podbrezová", "POD", "#0a8f3c", "#ffffff", 64],
  ["svk_kos", "Košice", "KOS", "#f5c400", "#111111", 64],
  ["svk_mic", "Zemplín Michalovce", "MIC", "#1f4fa0", "#f5c400", 62],
];

const SVN: Raw[] = [
  ["svn_olim", "Olimpija Ljubljana", "OLI", "#0a8f3c", "#ffffff", 70],
  ["svn_mar", "Maribor", "MAR", "#5b2d8e", "#f5c400", 69],
  ["svn_cel", "Celje", "CEL", "#f5c400", "#1f4fa0", 69],
  ["svn_mur", "Mura", "MUR", "#111111", "#f5c400", 65],
  ["svn_bra", "Bravo", "BRA", "#0a8f3c", "#ffffff", 64],
  ["svn_kop", "Koper", "KOP", "#f5c400", "#0a8f3c", 65],
  ["svn_dom", "Domžale", "DOM", "#f5c400", "#1f4fa0", 63],
  ["svn_rad", "Radomlje", "RAD", "#0a8f3c", "#ffffff", 62],
];

const CYP: Raw[] = [
  ["cyp_apo", "APOEL", "APO", "#1f4fa0", "#f5c400", 70],
  ["cyp_omo", "Omonia", "OMO", "#0a8f3c", "#ffffff", 70],
  ["cyp_apol", "Apollon Limassol", "APL", "#1f4fa0", "#ffffff", 69],
  ["cyp_ael", "AEL Limassol", "AEL", "#f5c400", "#1f4fa0", 67],
  ["cyp_ari", "Aris Limassol", "ARI", "#f5c400", "#1f4fa0", 69],
  ["cyp_pafos", "Pafos FC", "PAF", "#1f4fa0", "#f5c400", 69],
  ["cyp_anor", "Anorthosis", "ANO", "#1f4fa0", "#ffffff", 66],
  ["cyp_ek", "Ethnikos Achna", "ETH", "#0a8f3c", "#ffffff", 63],
];

const IRL: Raw[] = [
  ["irl_sha", "Shamrock Rovers", "SHA", "#0a8f3c", "#ffffff", 69],
  ["irl_shel", "Shelbourne", "SHE", "#c8102e", "#ffffff", 67],
  ["irl_der", "Derry City", "DER", "#c8102e", "#ffffff", 67],
  ["irl_boh", "Bohemians", "BOH", "#c8102e", "#111111", 66],
  ["irl_stp", "St Patrick's Athletic", "STP", "#c8102e", "#ffffff", 66],
  ["irl_gal", "Galway United", "GAL", "#7a1b30", "#ffffff", 63],
  ["irl_dro", "Drogheda United", "DRO", "#c8102e", "#111111", 63],
  ["irl_wat", "Waterford", "WAT", "#1f4fa0", "#ffffff", 63],
];

const FIN: Raw[] = [
  ["fin_hjk", "HJK Helsinki", "HJK", "#1f4fa0", "#ffffff", 69],
  ["fin_kup", "KuPS", "KUP", "#f5c400", "#111111", 68],
  ["fin_ilv", "Ilves", "ILV", "#0a8f3c", "#ffffff", 66],
  ["fin_int", "Inter Turku", "INT", "#1f4fa0", "#ffffff", 66],
  ["fin_sjk", "SJK", "SJK", "#111111", "#ffffff", 65],
  ["fin_vps", "VPS", "VPS", "#1f4fa0", "#f5c400", 63],
  ["fin_hak", "Haka", "HAK", "#1f4fa0", "#ffffff", 62],
  ["fin_ifk", "IFK Mariehamn", "IFK", "#c8102e", "#ffffff", 62],
];

const ISL: Raw[] = [
  ["isl_val", "Valur", "VAL", "#c8102e", "#ffffff", 64],
  ["isl_bre", "Breiðablik", "BRE", "#0a8f3c", "#ffffff", 66],
  ["isl_vik", "Víkingur Reykjavík", "VIK", "#c8102e", "#111111", 65],
  ["isl_kr", "KR Reykjavík", "KR", "#111111", "#ffffff", 64],
  ["isl_fh", "FH Hafnarfjörður", "FH", "#1f4fa0", "#ffffff", 63],
  ["isl_stj", "Stjarnan", "STJ", "#1f4fa0", "#f5c400", 62],
  ["isl_kef", "Keflavík", "KEF", "#1f4fa0", "#ffffff", 61],
  ["isl_fra", "Fram", "FRA", "#1f4fa0", "#c8102e", 60],
];

const VEN: Raw[] = [
  ["ven_cara", "Caracas FC", "CAR", "#c8102e", "#111111", 67],
  ["ven_tac", "Deportivo Táchira", "TAC", "#f5c400", "#111111", 67],
  ["ven_lag", "Deportivo La Guaira", "LAG", "#f5820a", "#1f4fa0", 66],
  ["ven_car", "Carabobo FC", "CBO", "#1f4fa0", "#ffffff", 66],
  ["ven_zam", "Zamora FC", "ZAM", "#111111", "#f5c400", 64],
  ["ven_mon", "Monagas", "MON", "#1f4fa0", "#f5c400", 64],
  ["ven_por", "Portuguesa", "POR", "#c8102e", "#111111", 62],
  ["ven_met", "Metropolitanos", "MET", "#0a8f3c", "#ffffff", 63],
];

const CRC: Raw[] = [
  ["crc_sap", "Saprissa", "SAP", "#5b2d8e", "#ffffff", 69],
  ["crc_ala", "LD Alajuelense", "ALA", "#c8102e", "#111111", 69],
  ["crc_her", "Herediano", "HER", "#f5c400", "#c8102e", 68],
  ["crc_car", "Cartaginés", "CAR", "#1f4fa0", "#ffffff", 66],
  ["crc_pun", "Puntarenas FC", "PUN", "#f5820a", "#111111", 63],
  ["crc_gua", "Guanacasteca", "GUA", "#0a8f3c", "#ffffff", 62],
  ["crc_sc", "San Carlos", "SCA", "#c8102e", "#f5c400", 62],
  ["crc_per", "Pérez Zeledón", "PZE", "#0a8f3c", "#ffffff", 61],
];

const IND: Raw[] = [
  ["ind_mob", "Mohun Bagan", "MBS", "#0a8f3c", "#7a1b30", 68],
  ["ind_beng", "Bengaluru FC", "BFC", "#1f4fa0", "#f5c400", 67],
  ["ind_mci", "Mumbai City", "MCI", "#7ec8e3", "#ffffff", 68],
  ["ind_fcg", "FC Goa", "GOA", "#f5820a", "#1f4fa0", 67],
  ["ind_ker", "Kerala Blasters", "KBF", "#f5c400", "#111111", 65],
  ["ind_eb", "East Bengal", "EBL", "#c8102e", "#f5c400", 64],
  ["ind_ohy", "Odisha FC", "ODI", "#5b2d8e", "#f5c400", 65],
  ["ind_jam", "Jamshedpur FC", "JAM", "#c8102e", "#111111", 64],
  ["ind_che", "Chennaiyin FC", "CHE", "#1f4fa0", "#f5c400", 63],
  ["ind_nor", "NorthEast United", "NEU", "#c8102e", "#111111", 62],
];

const CHN: Raw[] = [
  ["chn_sha", "Shanghai Port", "SHP", "#c8102e", "#111111", 73],
  ["chn_shen", "Shanghai Shenhua", "SHE", "#1f4fa0", "#ffffff", 72],
  ["chn_bei", "Beijing Guoan", "BEI", "#0a8f3c", "#ffffff", 72],
  ["chn_shan", "Shandong Taishan", "SHA", "#f5820a", "#111111", 73],
  ["chn_che", "Chengdu Rongcheng", "CHE", "#c8102e", "#f5c400", 71],
  ["chn_zhe", "Zhejiang FC", "ZHE", "#0a8f3c", "#ffffff", 70],
  ["chn_wuh", "Wuhan Three Towns", "WUH", "#c8102e", "#ffffff", 70],
  ["chn_hen", "Henan FC", "HEN", "#c8102e", "#f5c400", 68],
  ["chn_qin", "Qingdao Hainiu", "QIN", "#1f4fa0", "#ffffff", 67],
  ["chn_tia", "Tianjin Jinmen Tiger", "TIA", "#1f4fa0", "#f5c400", 68],
];

const MAS: Raw[] = [
  ["mas_jdt", "Johor Darul Ta'zim", "JDT", "#1f4fa0", "#f5c400", 72],
  ["mas_sel", "Selangor", "SEL", "#c8102e", "#f5c400", 67],
  ["mas_ter", "Terengganu", "TER", "#111111", "#f5c400", 66],
  ["mas_sab", "Sabah FC", "SAB", "#1f4fa0", "#ffffff", 66],
  ["mas_kdh", "Kedah Darul Aman", "KDA", "#0a8f3c", "#f5c400", 64],
  ["mas_neg", "Negeri Sembilan", "NSE", "#c8102e", "#111111", 63],
  ["mas_pen", "Penang", "PEN", "#1f4fa0", "#ffffff", 62],
  ["mas_pdrm", "PDRM", "PDR", "#1f4fa0", "#f5c400", 61],
];

const VIE: Raw[] = [
  ["vie_han", "Hanoi FC", "HAN", "#5b2d8e", "#ffffff", 67],
  ["vie_cak", "CAHN", "CAH", "#c8102e", "#f5c400", 67],
  ["vie_nam", "Nam Định", "NAM", "#f5c400", "#111111", 66],
  ["vie_bin", "Becamex Bình Dương", "BBD", "#1f4fa0", "#ffffff", 65],
  ["vie_thanh", "Thanh Hóa", "THA", "#f5820a", "#111111", 64],
  ["vie_vie", "Viettel", "VTL", "#c8102e", "#111111", 65],
  ["vie_hag", "Hoàng Anh Gia Lai", "HAG", "#1f4fa0", "#f5c400", 62],
  ["vie_hcm", "TP Hồ Chí Minh", "HCM", "#c8102e", "#1f4fa0", 62],
];

const ALG: Raw[] = [
  ["alg_cra", "CR Belouizdad", "CRB", "#c8102e", "#ffffff", 70],
  ["alg_mca", "MC Alger", "MCA", "#0a8f3c", "#c8102e", 70],
  ["alg_jsk", "JS Kabylie", "JSK", "#f5c400", "#0a8f3c", 69],
  ["alg_usm", "USM Alger", "USM", "#c8102e", "#111111", 69],
  ["alg_ess", "ES Sétif", "ESS", "#111111", "#ffffff", 68],
  ["alg_cs", "CS Constantine", "CSC", "#0a8f3c", "#ffffff", 67],
  ["alg_par", "Paradou AC", "PAC", "#f5c400", "#1f4fa0", 65],
  ["alg_bel", "USM Khenchela", "USK", "#c8102e", "#f5c400", 63],
];

const TUN: Raw[] = [
  ["tun_est", "Espérance de Tunis", "EST", "#c8102e", "#f5c400", 72],
  ["tun_eta", "Étoile du Sahel", "ESS", "#c8102e", "#f5c400", 70],
  ["tun_csa", "Club Africain", "CA", "#c8102e", "#ffffff", 69],
  ["tun_cab", "CA Bizertin", "CAB", "#f5c400", "#111111", 66],
  ["tun_ust", "US Monastir", "USM", "#1f4fa0", "#ffffff", 67],
  ["tun_sta", "Stade Tunisien", "STA", "#0a8f3c", "#c8102e", 65],
  ["tun_jsk", "JS Kairouan", "JSK", "#f5c400", "#111111", 63],
  ["tun_ols", "Olympique Béja", "OB", "#0a8f3c", "#ffffff", 62],
];

const GHA: Raw[] = [
  ["gha_hea", "Hearts of Oak", "HOK", "#c8102e", "#f5c400", 66],
  ["gha_kot", "Asante Kotoko", "KOT", "#c8102e", "#ffffff", 67],
  ["gha_ade", "Aduana Stars", "ADU", "#f5c400", "#0a8f3c", 65],
  ["gha_med", "Medeama", "MED", "#f5c400", "#111111", 65],
  ["gha_ber", "Berekum Chelsea", "BCH", "#1f4fa0", "#ffffff", 63],
  ["gha_bec", "Bechem United", "BEC", "#0a8f3c", "#ffffff", 63],
  ["gha_nsu", "Nsoatreman", "NSO", "#c8102e", "#111111", 62],
  ["gha_sam", "Samartex", "SAM", "#0a8f3c", "#f5c400", 62],
];

const KEN: Raw[] = [
  ["ken_gor", "Gor Mahia", "GOR", "#0a8f3c", "#ffffff", 65],
  ["ken_afc", "AFC Leopards", "AFC", "#1f4fa0", "#ffffff", 63],
  ["ken_tus", "Tusker FC", "TUS", "#c8102e", "#ffffff", 64],
  ["ken_ken", "Kenya Police", "KPO", "#1f4fa0", "#f5c400", 63],
  ["ken_ban", "Bandari", "BAN", "#f5820a", "#1f4fa0", 62],
  ["ken_ulinzi", "Ulinzi Stars", "ULI", "#0a8f3c", "#f5c400", 61],
  ["ken_shab", "Shabana", "SHA", "#0a8f3c", "#ffffff", 60],
  ["ken_muran", "Murang'a Seal", "MUR", "#1f4fa0", "#ffffff", 60],
];

const ANG: Raw[] = [
  ["ang_pet", "Petro de Luanda", "PET", "#c8102e", "#f5c400", 67],
  ["ang_pri", "Primeiro de Agosto", "1AG", "#c8102e", "#111111", 67],
  ["ang_sag", "Sagrada Esperança", "SAG", "#f5c400", "#0a8f3c", 64],
  ["ang_int", "Interclube", "INT", "#1f4fa0", "#ffffff", 63],
  ["ang_bra", "Bravos do Maquis", "BRA", "#0a8f3c", "#f5c400", 62],
  ["ang_wil", "Wiliete", "WIL", "#1f4fa0", "#f5c400", 61],
  ["ang_kab", "Kabuscorp", "KAB", "#c8102e", "#ffffff", 61],
  ["ang_lun", "Lunda Sul", "LUN", "#f5820a", "#111111", 60],
];

const POR2: Raw[] = [
  ["por2_uni", "União de Leiria", "UDL", "#c8102e", "#111111", 64],
  ["por2_ave", "Desportivo de Aves", "AVE", "#f5c400", "#111111", 63],
  ["por2_lei", "Leixões", "LEI", "#c8102e", "#ffffff", 65],
  ["por2_ten", "Tondela", "TON", "#f5c400", "#1f4fa0", 66],
  ["por2_pen", "Penafiel", "PEN", "#c8102e", "#f5c400", 64],
  ["por2_mar", "Marítimo", "MAR", "#0a8f3c", "#c8102e", 67],
  ["por2_cha", "Chaves", "CHA", "#c8102e", "#1f4fa0", 66],
  ["por2_ben", "Benfica B", "BEB", "#c8102e", "#ffffff", 65],
  ["por2_por", "FC Porto B", "POB", "#1f4fa0", "#ffffff", 65],
  ["por2_fei", "Feirense", "FEI", "#c8102e", "#f5c400", 64],
];

const NED2: Raw[] = [
  ["ned2_roda", "Roda JC", "ROD", "#f5c400", "#111111", 64],
  ["ned2_den", "De Graafschap", "GRA", "#1f4fa0", "#ffffff", 64],
  ["ned2_vvv", "VVV-Venlo", "VVV", "#f5c400", "#111111", 63],
  ["ned2_cam", "Cambuur", "CAM", "#f5c400", "#1f4fa0", 66],
  ["ned2_emm", "FC Emmen", "EMM", "#c8102e", "#ffffff", 65],
  ["ned2_den2", "Den Bosch", "DBO", "#1f4fa0", "#f5c400", 62],
  ["ned2_ein", "FC Eindhoven", "EIN", "#1f4fa0", "#ffffff", 63],
  ["ned2_hel", "Helmond Sport", "HEL", "#c8102e", "#111111", 61],
  ["ned2_jong", "Jong AZ", "JAZ", "#c8102e", "#ffffff", 62],
  ["ned2_ado", "ADO Den Haag", "ADO", "#0a8f3c", "#f5c400", 65],
];

const BRA3: Raw[] = [
  ["bra3_bot_pb", "Botafogo-PB", "BPB", "#c8102e", "#111111", 60],
  ["bra3_lon", "Londrina", "LON", "#1f4fa0", "#ffffff", 61],
  ["bra3_sam", "Sampaio Corrêa", "SAM", "#c8102e", "#f5c400", 60],
  ["bra3_flo", "Floresta", "FLO", "#0a8f3c", "#ffffff", 58],
  ["bra3_ita", "Ituano", "ITU", "#c8102e", "#111111", 61],
  ["bra3_sao_ber", "São Bernardo", "SBE", "#f5c400", "#111111", 60],
  ["bra3_bra", "Brusque", "BRU", "#1f4fa0", "#f5c400", 60],
  ["bra3_ypi", "Ypiranga", "YPI", "#c8102e", "#111111", 59],
  ["bra3_abc", "ABC", "ABC", "#111111", "#ffffff", 60],
  ["bra3_cax", "Caxias", "CAX", "#0a8f3c", "#f5c400", 59],
];

const ARG2: Raw[] = [
  ["arg2_san", "San Martín de Tucumán", "SMT", "#c8102e", "#ffffff", 64],
  ["arg2_gim", "Gimnasia de Mendoza", "GIM", "#1f4fa0", "#ffffff", 63],
  ["arg2_all", "All Boys", "ALB", "#111111", "#ffffff", 62],
  ["arg2_col", "Colegiales", "COL", "#f5c400", "#111111", 61],
  ["arg2_atl", "Atlanta", "ATL", "#f5c400", "#1f4fa0", 62],
  ["arg2_qui", "Quilmes", "QUI", "#7ec8e3", "#ffffff", 64],
  ["arg2_fer", "Ferro Carril Oeste", "FER", "#0a8f3c", "#ffffff", 63],
  ["arg2_alm", "Almagro", "ALM", "#1f4fa0", "#ffffff", 61],
  ["arg2_nue", "Nueva Chicago", "NCH", "#0a8f3c", "#111111", 61],
  ["arg2_dep", "Deportivo Madryn", "DMA", "#f5820a", "#111111", 62],
];

const TUR2: Raw[] = [
  ["tur2_boluspor", "Boluspor", "BOL", "#c8102e", "#ffffff", 64],
  ["tur2_erz", "Erzurumspor", "ERZ", "#1f4fa0", "#ffffff", 65],
  ["tur2_sak", "Sakaryaspor", "SAK", "#0a8f3c", "#111111", 65],
  ["tur2_key", "Keçiörengücü", "KEC", "#5b2d8e", "#ffffff", 63],
  ["tur2_ban", "Bandırmaspor", "BAN", "#c8102e", "#ffffff", 64],
  ["tur2_ada", "Adanaspor", "ADA", "#f5820a", "#ffffff", 63],
  ["tur2_man", "Manisa FK", "MAN", "#c8102e", "#111111", 63],
  ["tur2_ama", "Amed SK", "AMD", "#0a8f3c", "#c8102e", 64],
  ["tur2_ist", "İstanbulspor", "IST", "#f5c400", "#111111", 62],
  ["tur2_ümr", "Ümraniyespor", "UMR", "#c8102e", "#111111", 62],
];

const SCO2: Raw[] = [
  ["sco2_dun", "Dunfermline", "DUN", "#111111", "#ffffff", 62],
  ["sco2_ray", "Raith Rovers", "RAI", "#1f4fa0", "#ffffff", 63],
  ["sco2_par", "Partick Thistle", "PAR", "#c8102e", "#f5c400", 63],
  ["sco2_ayr", "Ayr United", "AYR", "#111111", "#ffffff", 62],
  ["sco2_air", "Airdrieonians", "AIR", "#ffffff", "#c8102e", 61],
  ["sco2_mor", "Greenock Morton", "MOR", "#1f4fa0", "#ffffff", 61],
  ["sco2_que", "Queen's Park", "QPK", "#111111", "#ffffff", 62],
  ["sco2_arb", "Arbroath", "ARB", "#7a1b30", "#ffffff", 60],
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

export const EXTRA_LEAGUES: League[] = [
  build("rus", "Premier Liga", "Rússia", "🇷🇺", RUS),
  build("isr", "Ligat ha'Al", "Israel", "🇮🇱", ISR),
  build("hun", "NB I", "Hungria", "🇭🇺", HUN),
  build("bul", "Parva Liga", "Bulgária", "🇧🇬", BUL),
  build("svk", "Niké Liga", "Eslováquia", "🇸🇰", SVK),
  build("svn", "PrvaLiga", "Eslovênia", "🇸🇮", SVN),
  build("cyp", "First Division", "Chipre", "🇨🇾", CYP),
  build("irl", "Premier Division", "Irlanda", "🇮🇪", IRL),
  build("fin", "Veikkausliiga", "Finlândia", "🇫🇮", FIN),
  build("isl", "Besta deild", "Islândia", "🇮🇸", ISL),
  build("ven", "Liga FUTVE", "Venezuela", "🇻🇪", VEN),
  build("crc", "Primera División", "Costa Rica", "🇨🇷", CRC),
  build("ind", "Indian Super League", "Índia", "🇮🇳", IND),
  build("chn", "Chinese Super League", "China", "🇨🇳", CHN),
  build("mas", "Super League", "Malásia", "🇲🇾", MAS),
  build("vie", "V.League 1", "Vietnã", "🇻🇳", VIE),
  build("alg", "Ligue 1", "Argélia", "🇩🇿", ALG),
  build("tun", "Ligue Professionnelle 1", "Tunísia", "🇹🇳", TUN),
  build("gha", "Premier League", "Gana", "🇬🇭", GHA),
  build("ken", "Premier League", "Quênia", "🇰🇪", KEN),
  build("ang", "Girabola", "Angola", "🇦🇴", ANG),
  build("por2", "Liga Portugal 2", "Portugal", "🇵🇹", POR2),
  build("ned2", "Eerste Divisie", "Holanda", "🇳🇱", NED2),
  build("bra3", "Brasileirão Série C", "Brasil", "🇧🇷", BRA3),
  build("arg2", "Primera Nacional", "Argentina", "🇦🇷", ARG2),
  build("tur2", "1. Lig", "Turquia", "🇹🇷", TUR2),
  build("sco2", "Scottish Championship", "Escócia", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", SCO2),
];
