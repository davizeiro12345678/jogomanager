import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * i18n — 39 idiomas, detecção automática pelo navegador, persistência local.
 * Tradução cobre o núcleo da interface (navegação, ações comuns, banner de convidado).
 * Chaves ausentes caem no inglês; idiomas RTL ajustam document.dir.
 */

export const LANGS = [
  "pt-BR", "pt-PT", "en", "es", "fr", "de", "it", "nl", "pl", "tr",
  "ru", "uk", "ar", "he", "fa", "hi", "bn", "id", "ms", "vi",
  "th", "ja", "ko", "zh-CN", "zh-TW", "sv", "no", "da", "fi", "cs",
  "sk", "hu", "ro", "el", "bg", "sr", "hr", "ca", "sw",
] as const;

export type Lang = (typeof LANGS)[number];

export const LANG_NAMES: Record<Lang, string> = {
  "pt-BR": "Português (Brasil)", "pt-PT": "Português (Portugal)", en: "English", es: "Español",
  fr: "Français", de: "Deutsch", it: "Italiano", nl: "Nederlands", pl: "Polski", tr: "Türkçe",
  ru: "Русский", uk: "Українська", ar: "العربية", he: "עברית", fa: "فارسی", hi: "हिन्दी",
  bn: "বাংলা", id: "Bahasa Indonesia", ms: "Bahasa Melayu", vi: "Tiếng Việt", th: "ไทย",
  ja: "日本語", ko: "한국어", "zh-CN": "简体中文", "zh-TW": "繁體中文", sv: "Svenska",
  no: "Norsk", da: "Dansk", fi: "Suomi", cs: "Čeština", sk: "Slovenčina", hu: "Magyar",
  ro: "Română", el: "Ελληνικά", bg: "Български", sr: "Српски", hr: "Hrvatski",
  ca: "Català", sw: "Kiswahili",
};

export const RTL_LANGS: ReadonlySet<Lang> = new Set(["ar", "he", "fa"]);

type Dict = Record<string, string>;

const ptBR: Dict = {
  "nav.panel": "Painel", "nav.central": "Central", "nav.squad": "Elenco", "nav.tactics": "Táticas",
  "nav.training": "Treino", "nav.league": "Liga", "nav.cups": "Copas", "nav.market": "Mercado",
  "nav.scouting": "Olheiros", "nav.finances": "Finanças", "nav.board": "Diretoria",
  "nav.stats": "Stats", "nav.news": "Notícias", "nav.history": "História", "nav.coach": "Career", "nav.auto": "Auto",
  "nav.awards": "Conquistas", "nav.editor": "Editor", "nav.ai": "Assistente", "nav.chat": "Chat", "nav.store": "Loja", "nav.purchases": "Compras", "nav.versus": "Multiplayer", "nav.replays": "Replays", "nav.visual": "Visual",
  "action.play": "Jogar", "action.signOut": "Sair", "action.saveCloud": "Salvar na nuvem",
  "guest.line1": "Você está jogando como convidado — o progresso fica salvo neste navegador.",
  "guest.cta": "Crie uma conta grátis",
  "guest.line2": "para jogar em outros aparelhos.",
  "shell.career": "Carreira", "shell.season": "Temporada", "shell.round": "Rodada",
  "shell.language": "Idioma",
};

const ptPT: Dict = {
  "nav.panel": "Painel", "nav.central": "Central", "nav.squad": "Plantel", "nav.tactics": "Táticas",
  "nav.training": "Treino", "nav.league": "Liga", "nav.cups": "Taças", "nav.market": "Mercado",
  "nav.scouting": "Olheiros", "nav.finances": "Finanças", "nav.board": "Direção",
  "nav.stats": "Estatísticas", "nav.news": "Notícias", "nav.history": "História", "nav.coach": "Carreira", "nav.auto": "Auto",
  "nav.awards": "Conquistas", "nav.editor": "Editor", "nav.ai": "Assistente", "nav.chat": "Chat", "nav.store": "Loja", "nav.purchases": "Compras", "nav.versus": "Multiplayer", "nav.replays": "Replays", "nav.visual": "Visual",
  "action.play": "Jogar", "action.signOut": "Sair", "action.saveCloud": "Guardar na nuvem",
  "guest.line1": "Está a jogar como convidado — o progresso fica guardado neste navegador.",
  "guest.cta": "Crie uma conta grátis",
  "guest.line2": "para jogar noutros dispositivos.",
  "shell.career": "Carreira", "shell.season": "Época", "shell.round": "Jornada",
  "shell.language": "Idioma",
};

const en: Dict = {
  "nav.panel": "Dashboard", "nav.central": "Club Hub", "nav.squad": "Squad", "nav.tactics": "Tactics",
  "nav.training": "Training", "nav.league": "League", "nav.cups": "Cups", "nav.market": "Transfers",
  "nav.scouting": "Scouting", "nav.finances": "Finances", "nav.board": "Board",
  "nav.stats": "Stats", "nav.news": "News", "nav.history": "History", "nav.coach": "Carrera", "nav.auto": "Auto",
  "nav.awards": "Achievements", "nav.editor": "Editor", "nav.ai": "Assistant", "nav.chat": "Chat", "nav.store": "Store", "nav.purchases": "Purchases", "nav.versus": "Multiplayer",
  "action.play": "Play", "action.signOut": "Sign out", "action.saveCloud": "Save to cloud",
  "guest.line1": "You're playing as a guest — progress is saved in this browser.",
  "guest.cta": "Create a free account",
  "guest.line2": "to play on other devices.",
  "shell.career": "Career", "shell.season": "Season", "shell.round": "Round",
  "shell.language": "Language",
};

const es: Dict = {
  "nav.panel": "Panel", "nav.central": "Central", "nav.squad": "Plantilla", "nav.tactics": "Tácticas",
  "nav.training": "Entrenamiento", "nav.league": "Liga", "nav.cups": "Copas", "nav.market": "Mercado",
  "nav.scouting": "Ojeadores", "nav.finances": "Finanzas", "nav.board": "Directiva",
  "nav.stats": "Estadísticas", "nav.news": "Noticias", "nav.history": "Historia",
  "action.play": "Jugar", "action.signOut": "Salir", "action.saveCloud": "Guardar en la nube",
  "guest.line1": "Juegas como invitado — el progreso se guarda en este navegador.",
  "guest.cta": "Crea una cuenta gratis",
  "guest.line2": "para jugar en otros dispositivos.",
  "shell.career": "Carrera", "shell.season": "Temporada", "shell.round": "Jornada",
  "shell.language": "Idioma",
};

const fr: Dict = {
  "nav.panel": "Tableau", "nav.central": "Club", "nav.squad": "Effectif", "nav.tactics": "Tactiques",
  "nav.training": "Entraînement", "nav.league": "Ligue", "nav.cups": "Coupes", "nav.market": "Mercato",
  "nav.scouting": "Recrutement", "nav.finances": "Finances", "nav.board": "Direction",
  "nav.stats": "Stats", "nav.news": "Actualités", "nav.history": "Historique",
  "action.play": "Jouer", "action.signOut": "Déconnexion", "action.saveCloud": "Sauvegarder en ligne",
  "guest.line1": "Vous jouez en invité — la progression est enregistrée dans ce navigateur.",
  "guest.cta": "Créez un compte gratuit",
  "guest.line2": "pour jouer sur d'autres appareils.",
  "shell.career": "Carrière", "shell.season": "Saison", "shell.round": "Journée",
  "shell.language": "Langue",
};

const de: Dict = {
  "nav.panel": "Übersicht", "nav.central": "Verein", "nav.squad": "Kader", "nav.tactics": "Taktik",
  "nav.training": "Training", "nav.league": "Liga", "nav.cups": "Pokale", "nav.market": "Transfers",
  "nav.scouting": "Scouting", "nav.finances": "Finanzen", "nav.board": "Vorstand",
  "nav.stats": "Statistik", "nav.news": "News", "nav.history": "Historie",
  "action.play": "Spielen", "action.signOut": "Abmelden", "action.saveCloud": "In der Cloud speichern",
  "guest.line1": "Du spielst als Gast — der Fortschritt wird in diesem Browser gespeichert.",
  "guest.cta": "Kostenloses Konto erstellen",
  "guest.line2": "um auf anderen Geräten zu spielen.",
  "shell.career": "Karriere", "shell.season": "Saison", "shell.round": "Spieltag",
  "shell.language": "Sprache",
};

const it: Dict = {
  "nav.panel": "Pannello", "nav.central": "Club", "nav.squad": "Rosa", "nav.tactics": "Tattiche",
  "nav.training": "Allenamento", "nav.league": "Campionato", "nav.cups": "Coppe", "nav.market": "Mercato",
  "nav.scouting": "Osservatori", "nav.finances": "Finanze", "nav.board": "Dirigenza",
  "nav.stats": "Statistiche", "nav.news": "Notizie", "nav.history": "Storia",
  "action.play": "Gioca", "action.signOut": "Esci", "action.saveCloud": "Salva sul cloud",
  "guest.line1": "Stai giocando come ospite — i progressi sono salvati in questo browser.",
  "guest.cta": "Crea un account gratuito",
  "guest.line2": "per giocare su altri dispositivi.",
  "shell.career": "Carriera", "shell.season": "Stagione", "shell.round": "Giornata",
  "shell.language": "Lingua",
};

const nl: Dict = {
  "nav.panel": "Dashboard", "nav.central": "Club", "nav.squad": "Selectie", "nav.tactics": "Tactiek",
  "nav.training": "Training", "nav.league": "Competitie", "nav.cups": "Bekers", "nav.market": "Transfers",
  "nav.scouting": "Scouting", "nav.finances": "Financiën", "nav.board": "Bestuur",
  "nav.stats": "Statistieken", "nav.news": "Nieuws", "nav.history": "Geschiedenis",
  "action.play": "Spelen", "action.signOut": "Uitloggen", "action.saveCloud": "Opslaan in de cloud",
  "guest.line1": "Je speelt als gast — voortgang wordt in deze browser opgeslagen.",
  "guest.cta": "Maak een gratis account",
  "guest.line2": "om op andere apparaten te spelen.",
  "shell.career": "Carrière", "shell.season": "Seizoen", "shell.round": "Speelronde",
  "shell.language": "Taal",
};

const pl: Dict = {
  "nav.panel": "Panel", "nav.central": "Klub", "nav.squad": "Kadra", "nav.tactics": "Taktyka",
  "nav.training": "Trening", "nav.league": "Liga", "nav.cups": "Puchary", "nav.market": "Transfery",
  "nav.scouting": "Skauting", "nav.finances": "Finanse", "nav.board": "Zarząd",
  "nav.stats": "Statystyki", "nav.news": "Wiadomości", "nav.history": "Historia",
  "action.play": "Graj", "action.signOut": "Wyloguj", "action.saveCloud": "Zapisz w chmurze",
  "guest.line1": "Grasz jako gość — postęp jest zapisywany w tej przeglądarce.",
  "guest.cta": "Utwórz darmowe konto",
  "guest.line2": "aby grać na innych urządzeniach.",
  "shell.career": "Kariera", "shell.season": "Sezon", "shell.round": "Kolejka",
  "shell.language": "Język",
};

const tr: Dict = {
  "nav.panel": "Panel", "nav.central": "Kulüp", "nav.squad": "Kadro", "nav.tactics": "Taktik",
  "nav.training": "Antrenman", "nav.league": "Lig", "nav.cups": "Kupalar", "nav.market": "Transfer",
  "nav.scouting": "Gözlemciler", "nav.finances": "Finans", "nav.board": "Yönetim",
  "nav.stats": "İstatistik", "nav.news": "Haberler", "nav.history": "Geçmiş",
  "action.play": "Oyna", "action.signOut": "Çıkış", "action.saveCloud": "Buluta kaydet",
  "guest.line1": "Misafir olarak oynuyorsun — ilerleme bu tarayıcıda saklanır.",
  "guest.cta": "Ücretsiz hesap oluştur",
  "guest.line2": "diğer cihazlarda oynamak için.",
  "shell.career": "Kariyer", "shell.season": "Sezon", "shell.round": "Hafta",
  "shell.language": "Dil",
};

const ru: Dict = {
  "nav.panel": "Панель", "nav.central": "Клуб", "nav.squad": "Состав", "nav.tactics": "Тактика",
  "nav.training": "Тренировка", "nav.league": "Лига", "nav.cups": "Кубки", "nav.market": "Трансферы",
  "nav.scouting": "Скауты", "nav.finances": "Финансы", "nav.board": "Руководство",
  "nav.stats": "Статистика", "nav.news": "Новости", "nav.history": "История",
  "action.play": "Играть", "action.signOut": "Выйти", "action.saveCloud": "Сохранить в облаке",
  "guest.line1": "Вы играете как гость — прогресс сохраняется в этом браузере.",
  "guest.cta": "Создайте бесплатный аккаунт",
  "guest.line2": "чтобы играть на других устройствах.",
  "shell.career": "Карьера", "shell.season": "Сезон", "shell.round": "Тур",
  "shell.language": "Язык",
};

const uk: Dict = {
  "nav.panel": "Панель", "nav.central": "Клуб", "nav.squad": "Склад", "nav.tactics": "Тактика",
  "nav.training": "Тренування", "nav.league": "Ліга", "nav.cups": "Кубки", "nav.market": "Трансфери",
  "nav.scouting": "Скаути", "nav.finances": "Фінанси", "nav.board": "Керівництво",
  "nav.stats": "Статистика", "nav.news": "Новини", "nav.history": "Історія",
  "action.play": "Грати", "action.signOut": "Вийти", "action.saveCloud": "Зберегти в хмарі",
  "guest.line1": "Ви граєте як гість — прогрес зберігається в цьому браузері.",
  "guest.cta": "Створіть безкоштовний акаунт",
  "guest.line2": "щоб грати на інших пристроях.",
  "shell.career": "Кар'єра", "shell.season": "Сезон", "shell.round": "Тур",
  "shell.language": "Мова",
};

const ar: Dict = {
  "nav.panel": "اللوحة", "nav.central": "النادي", "nav.squad": "التشكيلة", "nav.tactics": "الخطط",
  "nav.training": "التدريب", "nav.league": "الدوري", "nav.cups": "الكؤوس", "nav.market": "الانتقالات",
  "nav.scouting": "الكشافون", "nav.finances": "المالية", "nav.board": "الإدارة",
  "nav.stats": "الإحصائيات", "nav.news": "الأخبار", "nav.history": "السجل",
  "action.play": "العب", "action.signOut": "خروج", "action.saveCloud": "حفظ في السحابة",
  "guest.line1": "أنت تلعب كضيف — يُحفظ تقدمك في هذا المتصفح.",
  "guest.cta": "أنشئ حسابًا مجانيًا",
  "guest.line2": "للعب على أجهزة أخرى.",
  "shell.career": "المسيرة", "shell.season": "الموسم", "shell.round": "الجولة",
  "shell.language": "اللغة",
};

const he: Dict = {
  "nav.panel": "לוח", "nav.central": "מועדון", "nav.squad": "סגל", "nav.tactics": "טקטיקה",
  "nav.training": "אימון", "nav.league": "ליגה", "nav.cups": "גביעים", "nav.market": "העברות",
  "nav.scouting": "סקאוטינג", "nav.finances": "כספים", "nav.board": "הנהלה",
  "nav.stats": "סטטיסטיקה", "nav.news": "חדשות", "nav.history": "היסטוריה",
  "action.play": "שחק", "action.signOut": "התנתק", "action.saveCloud": "שמור בענן",
  "guest.line1": "אתה משחק כאורח — ההתקדמות נשמרת בדפדפן זה.",
  "guest.cta": "צור חשבון חינם",
  "guest.line2": "כדי לשחק במכשירים אחרים.",
  "shell.career": "קריירה", "shell.season": "עונה", "shell.round": "מחזור",
  "shell.language": "שפה",
};

const fa: Dict = {
  "nav.panel": "داشبورد", "nav.central": "باشگاه", "nav.squad": "ترکیب", "nav.tactics": "تاکتیک",
  "nav.training": "تمرین", "nav.league": "لیگ", "nav.cups": "جام‌ها", "nav.market": "نقل‌وانتقالات",
  "nav.scouting": "اسکاوت", "nav.finances": "مالی", "nav.board": "هیئت‌مدیره",
  "nav.stats": "آمار", "nav.news": "اخبار", "nav.history": "تاریخچه",
  "action.play": "بازی", "action.signOut": "خروج", "action.saveCloud": "ذخیره در ابر",
  "guest.line1": "شما به‌عنوان مهمان بازی می‌کنید — پیشرفت در همین مرورگر ذخیره می‌شود.",
  "guest.cta": "حساب رایگان بسازید",
  "guest.line2": "تا روی دستگاه‌های دیگر بازی کنید.",
  "shell.career": "دوران مربیگری", "shell.season": "فصل", "shell.round": "هفته",
  "shell.language": "زبان",
};

const hi: Dict = {
  "nav.panel": "डैशबोर्ड", "nav.central": "क्लब", "nav.squad": "टीम", "nav.tactics": "रणनीति",
  "nav.training": "प्रशिक्षण", "nav.league": "लीग", "nav.cups": "कप", "nav.market": "ट्रांसफ़र",
  "nav.scouting": "स्काउटिंग", "nav.finances": "वित्त", "nav.board": "बोर्ड",
  "nav.stats": "आंकड़े", "nav.news": "समाचार", "nav.history": "इतिहास",
  "action.play": "खेलें", "action.signOut": "लॉग आउट", "action.saveCloud": "क्लाउड में सहेजें",
  "guest.line1": "आप अतिथि के रूप में खेल रहे हैं — प्रगति इसी ब्राउज़र में सहेजी जाती है।",
  "guest.cta": "मुफ़्त खाता बनाएं",
  "guest.line2": "अन्य डिवाइस पर खेलने के लिए।",
  "shell.career": "करियर", "shell.season": "सीज़न", "shell.round": "राउंड",
  "shell.language": "भाषा",
};

const bn: Dict = {
  "nav.panel": "ড্যাশবোর্ড", "nav.central": "ক্লাব", "nav.squad": "দল", "nav.tactics": "কৌশল",
  "nav.training": "অনুশীলন", "nav.league": "লিগ", "nav.cups": "কাপ", "nav.market": "ট্রান্সফার",
  "nav.scouting": "স্কাউটিং", "nav.finances": "অর্থ", "nav.board": "বোর্ড",
  "nav.stats": "পরিসংখ্যান", "nav.news": "খবর", "nav.history": "ইতিহাস",
  "action.play": "খেলুন", "action.signOut": "লগ আউট", "action.saveCloud": "ক্লাউডে সংরক্ষণ",
  "guest.line1": "আপনি অতিথি হিসেবে খেলছেন — অগ্রগতি এই ব্রাউজারে সংরক্ষিত হয়।",
  "guest.cta": "বিনামূল্যে অ্যাকাউন্ট তৈরি করুন",
  "guest.line2": "অন্য ডিভাইসে খেলতে।",
  "shell.career": "ক্যারিয়ার", "shell.season": "মৌসুম", "shell.round": "রাউন্ড",
  "shell.language": "ভাষা",
};

const id: Dict = {
  "nav.panel": "Dasbor", "nav.central": "Klub", "nav.squad": "Skuad", "nav.tactics": "Taktik",
  "nav.training": "Latihan", "nav.league": "Liga", "nav.cups": "Piala", "nav.market": "Transfer",
  "nav.scouting": "Pemandu Bakat", "nav.finances": "Keuangan", "nav.board": "Direksi",
  "nav.stats": "Statistik", "nav.news": "Berita", "nav.history": "Riwayat",
  "action.play": "Main", "action.signOut": "Keluar", "action.saveCloud": "Simpan ke cloud",
  "guest.line1": "Anda bermain sebagai tamu — progres disimpan di browser ini.",
  "guest.cta": "Buat akun gratis",
  "guest.line2": "untuk bermain di perangkat lain.",
  "shell.career": "Karier", "shell.season": "Musim", "shell.round": "Pekan",
  "shell.language": "Bahasa",
};

const ms: Dict = {
  "nav.panel": "Papan Pemuka", "nav.central": "Kelab", "nav.squad": "Skuad", "nav.tactics": "Taktik",
  "nav.training": "Latihan", "nav.league": "Liga", "nav.cups": "Piala", "nav.market": "Pemindahan",
  "nav.scouting": "Pencari Bakat", "nav.finances": "Kewangan", "nav.board": "Lembaga",
  "nav.stats": "Statistik", "nav.news": "Berita", "nav.history": "Sejarah",
  "action.play": "Main", "action.signOut": "Log keluar", "action.saveCloud": "Simpan ke awan",
  "guest.line1": "Anda bermain sebagai tetamu — kemajuan disimpan dalam pelayar ini.",
  "guest.cta": "Cipta akaun percuma",
  "guest.line2": "untuk bermain pada peranti lain.",
  "shell.career": "Kerjaya", "shell.season": "Musim", "shell.round": "Pusingan",
  "shell.language": "Bahasa",
};

const vi: Dict = {
  "nav.panel": "Bảng điều khiển", "nav.central": "Câu lạc bộ", "nav.squad": "Đội hình", "nav.tactics": "Chiến thuật",
  "nav.training": "Tập luyện", "nav.league": "Giải đấu", "nav.cups": "Cúp", "nav.market": "Chuyển nhượng",
  "nav.scouting": "Tuyển trạch", "nav.finances": "Tài chính", "nav.board": "Ban lãnh đạo",
  "nav.stats": "Thống kê", "nav.news": "Tin tức", "nav.history": "Lịch sử",
  "action.play": "Chơi", "action.signOut": "Đăng xuất", "action.saveCloud": "Lưu lên đám mây",
  "guest.line1": "Bạn đang chơi với tư cách khách — tiến trình được lưu trong trình duyệt này.",
  "guest.cta": "Tạo tài khoản miễn phí",
  "guest.line2": "để chơi trên các thiết bị khác.",
  "shell.career": "Sự nghiệp", "shell.season": "Mùa giải", "shell.round": "Vòng",
  "shell.language": "Ngôn ngữ",
};

const th: Dict = {
  "nav.panel": "แดชบอร์ด", "nav.central": "สโมสร", "nav.squad": "ทีม", "nav.tactics": "แผนการเล่น",
  "nav.training": "ฝึกซ้อม", "nav.league": "ลีก", "nav.cups": "ถ้วย", "nav.market": "ตลาดซื้อขาย",
  "nav.scouting": "แมวมอง", "nav.finances": "การเงิน", "nav.board": "บอร์ดบริหาร",
  "nav.stats": "สถิติ", "nav.news": "ข่าว", "nav.history": "ประวัติ",
  "action.play": "เล่น", "action.signOut": "ออกจากระบบ", "action.saveCloud": "บันทึกขึ้นคลาวด์",
  "guest.line1": "คุณกำลังเล่นในฐานะผู้เยี่ยมชม — ความคืบหน้าจะถูกบันทึกในเบราว์เซอร์นี้",
  "guest.cta": "สร้างบัญชีฟรี",
  "guest.line2": "เพื่อเล่นบนอุปกรณ์อื่น",
  "shell.career": "อาชีพ", "shell.season": "ฤดูกาล", "shell.round": "นัด",
  "shell.language": "ภาษา",
};

const ja: Dict = {
  "nav.panel": "ダッシュボード", "nav.central": "クラブ", "nav.squad": "スカッド", "nav.tactics": "戦術",
  "nav.training": "トレーニング", "nav.league": "リーグ", "nav.cups": "カップ", "nav.market": "移籍",
  "nav.scouting": "スカウト", "nav.finances": "財務", "nav.board": "理事会",
  "nav.stats": "スタッツ", "nav.news": "ニュース", "nav.history": "履歴",
  "action.play": "プレイ", "action.signOut": "ログアウト", "action.saveCloud": "クラウドに保存",
  "guest.line1": "ゲストとしてプレイ中 — 進行状況はこのブラウザに保存されます。",
  "guest.cta": "無料アカウントを作成",
  "guest.line2": "して他のデバイスでもプレイ。",
  "shell.career": "キャリア", "shell.season": "シーズン", "shell.round": "節",
  "shell.language": "言語",
};

const ko: Dict = {
  "nav.panel": "대시보드", "nav.central": "클럽", "nav.squad": "스쿼드", "nav.tactics": "전술",
  "nav.training": "훈련", "nav.league": "리그", "nav.cups": "컵", "nav.market": "이적시장",
  "nav.scouting": "스카우팅", "nav.finances": "재정", "nav.board": "이사회",
  "nav.stats": "통계", "nav.news": "뉴스", "nav.history": "기록",
  "action.play": "플레이", "action.signOut": "로그아웃", "action.saveCloud": "클라우드에 저장",
  "guest.line1": "게스트로 플레이 중 — 진행 상황은 이 브라우저에 저장됩니다.",
  "guest.cta": "무료 계정 만들기",
  "guest.line2": "로 다른 기기에서도 플레이하세요.",
  "shell.career": "커리어", "shell.season": "시즌", "shell.round": "라운드",
  "shell.language": "언어",
};

const zhCN: Dict = {
  "nav.panel": "面板", "nav.central": "俱乐部", "nav.squad": "阵容", "nav.tactics": "战术",
  "nav.training": "训练", "nav.league": "联赛", "nav.cups": "杯赛", "nav.market": "转会",
  "nav.scouting": "球探", "nav.finances": "财务", "nav.board": "董事会",
  "nav.stats": "数据", "nav.news": "新闻", "nav.history": "历史",
  "action.play": "比赛", "action.signOut": "退出", "action.saveCloud": "保存到云端",
  "guest.line1": "您正在以访客身份游玩 — 进度保存在此浏览器中。",
  "guest.cta": "创建免费账户",
  "guest.line2": "即可在其他设备上游玩。",
  "shell.career": "生涯", "shell.season": "赛季", "shell.round": "轮次",
  "shell.language": "语言",
};

const zhTW: Dict = {
  "nav.panel": "面板", "nav.central": "俱樂部", "nav.squad": "陣容", "nav.tactics": "戰術",
  "nav.training": "訓練", "nav.league": "聯賽", "nav.cups": "盃賽", "nav.market": "轉會",
  "nav.scouting": "球探", "nav.finances": "財務", "nav.board": "董事會",
  "nav.stats": "數據", "nav.news": "新聞", "nav.history": "歷史",
  "action.play": "比賽", "action.signOut": "登出", "action.saveCloud": "儲存到雲端",
  "guest.line1": "您正以訪客身分遊玩 — 進度會儲存在此瀏覽器中。",
  "guest.cta": "建立免費帳戶",
  "guest.line2": "即可在其他裝置上遊玩。",
  "shell.career": "生涯", "shell.season": "賽季", "shell.round": "輪次",
  "shell.language": "語言",
};

const sv: Dict = {
  "nav.panel": "Översikt", "nav.central": "Klubb", "nav.squad": "Trupp", "nav.tactics": "Taktik",
  "nav.training": "Träning", "nav.league": "Liga", "nav.cups": "Cuper", "nav.market": "Transfers",
  "nav.scouting": "Scouting", "nav.finances": "Ekonomi", "nav.board": "Styrelse",
  "nav.stats": "Statistik", "nav.news": "Nyheter", "nav.history": "Historik",
  "action.play": "Spela", "action.signOut": "Logga ut", "action.saveCloud": "Spara i molnet",
  "guest.line1": "Du spelar som gäst — framsteg sparas i den här webbläsaren.",
  "guest.cta": "Skapa ett gratis konto",
  "guest.line2": "för att spela på andra enheter.",
  "shell.career": "Karriär", "shell.season": "Säsong", "shell.round": "Omgång",
  "shell.language": "Språk",
};

const no: Dict = {
  "nav.panel": "Oversikt", "nav.central": "Klubb", "nav.squad": "Tropp", "nav.tactics": "Taktikk",
  "nav.training": "Trening", "nav.league": "Liga", "nav.cups": "Cuper", "nav.market": "Overganger",
  "nav.scouting": "Speiding", "nav.finances": "Økonomi", "nav.board": "Styre",
  "nav.stats": "Statistikk", "nav.news": "Nyheter", "nav.history": "Historie",
  "action.play": "Spill", "action.signOut": "Logg ut", "action.saveCloud": "Lagre i skyen",
  "guest.line1": "Du spiller som gjest — fremdriften lagres i denne nettleseren.",
  "guest.cta": "Opprett en gratis konto",
  "guest.line2": "for å spille på andre enheter.",
  "shell.career": "Karriere", "shell.season": "Sesong", "shell.round": "Runde",
  "shell.language": "Språk",
};

const da: Dict = {
  "nav.panel": "Oversigt", "nav.central": "Klub", "nav.squad": "Trup", "nav.tactics": "Taktik",
  "nav.training": "Træning", "nav.league": "Liga", "nav.cups": "Pokaler", "nav.market": "Transfers",
  "nav.scouting": "Scouting", "nav.finances": "Økonomi", "nav.board": "Bestyrelse",
  "nav.stats": "Statistik", "nav.news": "Nyheder", "nav.history": "Historik",
  "action.play": "Spil", "action.signOut": "Log ud", "action.saveCloud": "Gem i skyen",
  "guest.line1": "Du spiller som gæst — fremskridt gemmes i denne browser.",
  "guest.cta": "Opret en gratis konto",
  "guest.line2": "for at spille på andre enheder.",
  "shell.career": "Karriere", "shell.season": "Sæson", "shell.round": "Runde",
  "shell.language": "Sprog",
};

const fi: Dict = {
  "nav.panel": "Yleisnäkymä", "nav.central": "Seura", "nav.squad": "Joukkue", "nav.tactics": "Taktiikka",
  "nav.training": "Harjoitus", "nav.league": "Liiga", "nav.cups": "Cupit", "nav.market": "Siirrot",
  "nav.scouting": "Kykyjenmetsästys", "nav.finances": "Talous", "nav.board": "Johto",
  "nav.stats": "Tilastot", "nav.news": "Uutiset", "nav.history": "Historia",
  "action.play": "Pelaa", "action.signOut": "Kirjaudu ulos", "action.saveCloud": "Tallenna pilveen",
  "guest.line1": "Pelaat vieraana — edistyminen tallennetaan tähän selaimeen.",
  "guest.cta": "Luo ilmainen tili",
  "guest.line2": "pelataksesi muilla laitteilla.",
  "shell.career": "Ura", "shell.season": "Kausi", "shell.round": "Kierros",
  "shell.language": "Kieli",
};

const cs: Dict = {
  "nav.panel": "Přehled", "nav.central": "Klub", "nav.squad": "Kádr", "nav.tactics": "Taktika",
  "nav.training": "Trénink", "nav.league": "Liga", "nav.cups": "Poháry", "nav.market": "Přestupy",
  "nav.scouting": "Skauting", "nav.finances": "Finance", "nav.board": "Vedení",
  "nav.stats": "Statistiky", "nav.news": "Novinky", "nav.history": "Historie",
  "action.play": "Hrát", "action.signOut": "Odhlásit", "action.saveCloud": "Uložit do cloudu",
  "guest.line1": "Hrajete jako host — postup se ukládá v tomto prohlížeči.",
  "guest.cta": "Vytvořte si účet zdarma",
  "guest.line2": "a hrajte na dalších zařízeních.",
  "shell.career": "Kariéra", "shell.season": "Sezóna", "shell.round": "Kolo",
  "shell.language": "Jazyk",
};

const sk: Dict = {
  "nav.panel": "Prehľad", "nav.central": "Klub", "nav.squad": "Káder", "nav.tactics": "Taktika",
  "nav.training": "Tréning", "nav.league": "Liga", "nav.cups": "Poháre", "nav.market": "Prestupy",
  "nav.scouting": "Skauting", "nav.finances": "Financie", "nav.board": "Vedenie",
  "nav.stats": "Štatistiky", "nav.news": "Novinky", "nav.history": "História",
  "action.play": "Hrať", "action.signOut": "Odhlásiť", "action.saveCloud": "Uložiť do cloudu",
  "guest.line1": "Hráte ako hosť — postup sa ukladá v tomto prehliadači.",
  "guest.cta": "Vytvorte si účet zadarmo",
  "guest.line2": "a hrajte na iných zariadeniach.",
  "shell.career": "Kariéra", "shell.season": "Sezóna", "shell.round": "Kolo",
  "shell.language": "Jazyk",
};

const hu: Dict = {
  "nav.panel": "Áttekintés", "nav.central": "Klub", "nav.squad": "Kiad", "nav.tactics": "Taktika",
  "nav.training": "Edzés", "nav.league": "Liga", "nav.cups": "Kupák", "nav.market": "Átigazolás",
  "nav.scouting": "Megfigyelők", "nav.finances": "Pénzügy", "nav.board": "Vezetőség",
  "nav.stats": "Statisztika", "nav.news": "Hírek", "nav.history": "Történelem",
  "action.play": "Játék", "action.signOut": "Kijelentkezés", "action.saveCloud": "Mentés felhőbe",
  "guest.line1": "Vendégként játszol — a haladás ebben a böngészőben mentődik.",
  "guest.cta": "Hozz létre ingyenes fiókot",
  "guest.line2": "hogy más eszközökön is játssz.",
  "shell.career": "Karrier", "shell.season": "Szezon", "shell.round": "Forduló",
  "shell.language": "Nyelv",
};

const ro: Dict = {
  "nav.panel": "Panou", "nav.central": "Club", "nav.squad": "Lot", "nav.tactics": "Tactici",
  "nav.training": "Antrenament", "nav.league": "Ligă", "nav.cups": "Cupe", "nav.market": "Transferuri",
  "nav.scouting": "Scouting", "nav.finances": "Finanțe", "nav.board": "Conducere",
  "nav.stats": "Statistici", "nav.news": "Știri", "nav.history": "Istoric",
  "action.play": "Joacă", "action.signOut": "Ieșire", "action.saveCloud": "Salvează în cloud",
  "guest.line1": "Joci ca oaspete — progresul este salvat în acest browser.",
  "guest.cta": "Creează un cont gratuit",
  "guest.line2": "pentru a juca pe alte dispozitive.",
  "shell.career": "Carieră", "shell.season": "Sezon", "shell.round": "Etapa",
  "shell.language": "Limbă",
};

const el: Dict = {
  "nav.panel": "Πίνακας", "nav.central": "Σύλλογος", "nav.squad": "Ομάδα", "nav.tactics": "Τακτική",
  "nav.training": "Προπόνηση", "nav.league": "Πρωτάθλημα", "nav.cups": "Κύπελλα", "nav.market": "Μεταγραφές",
  "nav.scouting": "Σκάουτινγκ", "nav.finances": "Οικονομικά", "nav.board": "Διοίκηση",
  "nav.stats": "Στατιστικά", "nav.news": "Ειδήσεις", "nav.history": "Ιστορία",
  "action.play": "Παίξε", "action.signOut": "Αποσύνδεση", "action.saveCloud": "Αποθήκευση στο cloud",
  "guest.line1": "Παίζετε ως επισκέπτης — η πρόοδος αποθηκεύεται σε αυτό το πρόγραμμα περιήγησης.",
  "guest.cta": "Δημιουργήστε δωρεάν λογαριασμό",
  "guest.line2": "για να παίζετε σε άλλες συσκευές.",
  "shell.career": "Καριέρα", "shell.season": "Σεζόν", "shell.round": "Αγωνιστική",
  "shell.language": "Γλώσσα",
};

const bg: Dict = {
  "nav.panel": "Табло", "nav.central": "Клуб", "nav.squad": "Състав", "nav.tactics": "Тактика",
  "nav.training": "Тренировка", "nav.league": "Лига", "nav.cups": "Купи", "nav.market": "Трансфери",
  "nav.scouting": "Скаути", "nav.finances": "Финанси", "nav.board": "Ръководство",
  "nav.stats": "Статистика", "nav.news": "Новини", "nav.history": "История",
  "action.play": "Играй", "action.signOut": "Изход", "action.saveCloud": "Запази в облака",
  "guest.line1": "Играете като гост — прогресът се пази в този браузър.",
  "guest.cta": "Създайте безплатен акаунт",
  "guest.line2": "за да играете на други устройства.",
  "shell.career": "Кариера", "shell.season": "Сезон", "shell.round": "Кръг",
  "shell.language": "Език",
};

const sr: Dict = {
  "nav.panel": "Панел", "nav.central": "Клуб", "nav.squad": "Тим", "nav.tactics": "Тактика",
  "nav.training": "Тренинг", "nav.league": "Лига", "nav.cups": "Купови", "nav.market": "Трансфери",
  "nav.scouting": "Скаути", "nav.finances": "Финансије", "nav.board": "Управа",
  "nav.stats": "Статистика", "nav.news": "Вести", "nav.history": "Историја",
  "action.play": "Играј", "action.signOut": "Одјава", "action.saveCloud": "Сачувај у облак",
  "guest.line1": "Играте као гост — напредак се чува у овом прегледачу.",
  "guest.cta": "Направите бесплатан налог",
  "guest.line2": "да играте на другим уређајима.",
  "shell.career": "Каријера", "shell.season": "Сезона", "shell.round": "Коло",
  "shell.language": "Језик",
};

const hr: Dict = {
  "nav.panel": "Pregled", "nav.central": "Klub", "nav.squad": "Momčad", "nav.tactics": "Taktika",
  "nav.training": "Trening", "nav.league": "Liga", "nav.cups": "Kupovi", "nav.market": "Transferi",
  "nav.scouting": "Skauti", "nav.finances": "Financije", "nav.board": "Uprava",
  "nav.stats": "Statistika", "nav.news": "Vijesti", "nav.history": "Povijest",
  "action.play": "Igraj", "action.signOut": "Odjava", "action.saveCloud": "Spremi u oblak",
  "guest.line1": "Igrate kao gost — napredak se sprema u ovom pregledniku.",
  "guest.cta": "Napravite besplatan račun",
  "guest.line2": "za igru na drugim uređajima.",
  "shell.career": "Karijera", "shell.season": "Sezona", "shell.round": "Kolo",
  "shell.language": "Jezik",
};

const ca: Dict = {
  "nav.panel": "Tauler", "nav.central": "Club", "nav.squad": "Plantilla", "nav.tactics": "Tàctiques",
  "nav.training": "Entrenament", "nav.league": "Lliga", "nav.cups": "Copes", "nav.market": "Mercat",
  "nav.scouting": "Observadors", "nav.finances": "Finances", "nav.board": "Directiva",
  "nav.stats": "Estadístiques", "nav.news": "Notícies", "nav.history": "Història",
  "action.play": "Juga", "action.signOut": "Surt", "action.saveCloud": "Desa al núvol",
  "guest.line1": "Jugues com a convidat — el progrés es desa en aquest navegador.",
  "guest.cta": "Crea un compte gratuït",
  "guest.line2": "per jugar en altres dispositius.",
  "shell.career": "Carrera", "shell.season": "Temporada", "shell.round": "Jornada",
  "shell.language": "Idioma",
};

const sw: Dict = {
  "nav.panel": "Dashibodi", "nav.central": "Klabu", "nav.squad": "Kikosi", "nav.tactics": "Mbinu",
  "nav.training": "Mazoezi", "nav.league": "Ligi", "nav.cups": "Kombe", "nav.market": "Uhamisho",
  "nav.scouting": "Upelelezi", "nav.finances": "Fedha", "nav.board": "Bodi",
  "nav.stats": "Takwimu", "nav.news": "Habari", "nav.history": "Historia",
  "action.play": "Cheza", "action.signOut": "Toka", "action.saveCloud": "Hifadhi kwenye wingu",
  "guest.line1": "Unacheza kama mgeni — maendeleo yamehifadhiwa kwenye kivinjari hiki.",
  "guest.cta": "Fungua akaunti ya bure",
  "guest.line2": "kucheza kwenye vifaa vingine.",
  "shell.career": "Kazi", "shell.season": "Msimu", "shell.round": "Mzunguko",
  "shell.language": "Lugha",
};

const DICTS: Record<Lang, Dict> = {
  "pt-BR": ptBR, "pt-PT": ptPT, en, es, fr, de, it, nl, pl, tr,
  ru, uk, ar, he, fa, hi, bn, id, ms, vi,
  th, ja, ko, "zh-CN": zhCN, "zh-TW": zhTW, sv, no, da, fi, cs,
  sk, hu, ro, el, bg, sr, hr, ca, sw,
};

const STORAGE_KEY = "pfm3d.lang";

function detect(): Lang {
  if (typeof window === "undefined") return "pt-BR";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && (LANGS as readonly string[]).includes(saved)) return saved as Lang;
    for (const nav of window.navigator.languages ?? [window.navigator.language]) {
      const tag = nav.toLowerCase();
      const exact = LANGS.find((l) => l.toLowerCase() === tag);
      if (exact) return exact;
      const prefix = tag.split("-")[0];
      if (prefix === "pt") return tag.includes("pt") && !tag.includes("br") ? "pt-PT" : "pt-BR";
      const byPrefix = LANGS.find((l) => l.toLowerCase().split("-")[0] === prefix);
      if (byPrefix) return byPrefix;
    }
  } catch {
    /* sem acesso ao storage */
  }
  return "pt-BR";
}

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
}

const I18nContext = createContext<I18nValue>({
  lang: "pt-BR",
  setLang: () => undefined,
  t: (k) => DICTS["pt-BR"][k] ?? en[k] ?? k,
  dir: "ltr",
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("pt-BR");

  useEffect(() => {
    setLangState(detect());
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const dir: "ltr" | "rtl" = RTL_LANGS.has(lang) ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      dir,
      t: (key: string) => DICTS[lang][key] ?? en[key] ?? ptBR[key] ?? key,
    }),
    [lang, setLang, dir],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext);
}
