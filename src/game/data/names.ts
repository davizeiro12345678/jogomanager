import { NAME_POOLS } from "./squads";

export interface NamePool {
  first: string[];
  last: string[];
}

const P = (first: string, last: string): NamePool => ({
  first: first.split(","),
  last: last.split(","),
});

/** Bancos de nomes por nacionalidade. */
export const POOLS: Record<string, NamePool> = {
  ...NAME_POOLS,
  ger: P(
    "Lukas,Jonas,Niklas,Maximilian,Felix,Tim,Leon,Moritz,Fabian,Julian,Marvin,Sven,Kai,Tobias,Jannik",
    "Müller,Schneider,Wagner,Becker,Hoffmann,Schulz,Krüger,Neumann,Brandt,Keller,Vogel,Hartmann,Ziegler,Böhm,Reuter",
  ),
  fra: P(
    "Lucas,Théo,Enzo,Hugo,Nathan,Mathis,Yanis,Clément,Baptiste,Corentin,Amine,Kylian,Noah,Antoine,Rayan",
    "Dubois,Lefèvre,Moreau,Girard,Bonnet,Rousseau,Perrin,Fontaine,Chevalier,Barbier,Renard,Marchand,Leroy,Dumont,Colin",
  ),
  por: P(
    "João,Diogo,Rúben,Tomás,Gonçalo,Rafael,Miguel,André,Francisco,Duarte,Afonso,Tiago,Vasco,Bernardo,Salvador",
    "Ferreira,Sousa,Fonseca,Marques,Machado,Neves,Cardoso,Faria,Baptista,Antunes,Matias,Ramos,Pinto,Coelho,Tavares",
  ),
  ned: P(
    "Daan,Sven,Bram,Lars,Jesse,Thijs,Ruben,Stijn,Joris,Milan,Sem,Teun,Koen,Jurriën,Rik",
    "de Vries,van Dijk,Bakker,Jansen,Visser,Smit,Meijer,de Boer,Mulder,Bos,Vermeulen,van Leeuwen,Hendriks,Dekker,Willems",
  ),
  bel: P(
    "Arthur,Louis,Victor,Matteo,Jules,Wout,Senne,Lander,Siebe,Thibaut,Maxime,Gilles,Aster,Lucas,Noa",
    "Peeters,Janssens,Maes,Willems,Claes,Goossens,Wouters,De Smet,Declercq,Vandenberghe,Lambert,Dupont,Mertens,Segers,Coppens",
  ),
  tur: P(
    "Emre,Burak,Kerem,Yusuf,Mert,Ozan,Halil,Berkay,Enes,Arda,Cengiz,Barış,Tolga,Serdar,Umut",
    "Yılmaz,Kaya,Demir,Çelik,Şahin,Yıldız,Aydın,Öztürk,Arslan,Doğan,Kılıç,Aslan,Koç,Polat,Erdem",
  ),
  sco: P(
    "Callum,Ryan,Kieran,Lewis,Scott,Fraser,Grant,Blair,Euan,Struan,Angus,Rory,Cameron,Craig,Murray",
    "MacLeod,Fraser,Campbell,Ferguson,Stewart,MacKay,Robertson,Murray,Hendry,Gallacher,Boyle,Douglas,Kinnear,Rankin,Sinclair",
  ),
  arg: P(
    "Santiago,Julián,Facundo,Lautaro,Franco,Agustín,Tomás,Nicolás,Valentín,Joaquín,Ezequiel,Matías,Bruno,Ignacio,Thiago",
    "González,Rodríguez,Fernández,Domínguez,Sosa,Acosta,Benítez,Quiroga,Ibarra,Ojeda,Cabrera,Peralta,Villalba,Cáceres,Aguirre",
  ),
  mex: P(
    "Diego,Ángel,Emilio,Kevin,Iker,Erick,Alexis,Uriel,Jesús,Roberto,Marco,Óscar,Israel,Rodolfo,Brian",
    "Hernández,Ramírez,Torres,Vázquez,Reyes,Mendoza,Guzmán,Salazar,Cervantes,Zamora,Ibarra,Alvarado,Rivas,Escobar,Nájera",
  ),
  usa: P(
    "Tyler,Brandon,Cole,Aidan,Caleb,Preston,Miles,Jaden,Chase,Dylan,Grant,Hunter,Trevor,Bryce,Landon",
    "Miller,Johnson,Peterson,Brooks,Hayes,Nelson,Reynolds,Carter,Sullivan,Bishop,Foster,Gallagher,Whitaker,Sanders,Lowry",
  ),
  sau: P(
    "Mohammed,Abdullah,Faisal,Salem,Nasser,Turki,Khalid,Yasser,Sultan,Bandar,Ziyad,Hattan,Fahad,Majed,Rakan",
    "Al-Harbi,Al-Otaibi,Al-Qahtani,Al-Ghamdi,Al-Dawsari,Al-Shehri,Al-Zahrani,Al-Mutairi,Al-Amri,Al-Buraikan,Al-Najei,Al-Faraj,Al-Hassan,Al-Sulaiman,Al-Yami",
  ),
  jpn: P(
    "Sota,Ren,Haruto,Yuto,Kaito,Riku,Sora,Takumi,Daiki,Hiroto,Kenta,Yuki,Shota,Ryo,Asahi",
    "Tanaka,Suzuki,Sato,Watanabe,Nakamura,Yamamoto,Kobayashi,Kato,Yoshida,Matsumoto,Inoue,Kimura,Hayashi,Saito,Ito",
  ),
  gre: P(
    "Giorgos,Dimitris,Nikos,Kostas,Christos,Vasilis,Panagiotis,Thanasis,Stelios,Manolis,Alexis,Petros,Andreas,Ilias,Sotiris",
    "Papadopoulos,Nikolaidis,Georgiou,Vlachos,Karagiannis,Samaras,Fotiadis,Michailidis,Stavrou,Antoniou,Dimitriou,Katsaros,Pappas,Rallis,Zafeiris",
  ),
  sui: P(
    "Noah,Elias,Levin,Nico,Yannick,Silvan,Loris,Dario,Andrin,Timo,Cedric,Joel,Robin,Nevio,Gian",
    "Meier,Steiner,Baumann,Frei,Zimmermann,Aebischer,Schmid,Widmer,Kobel,Rieder,Furrer,Marchand,Sierro,Amdouni,Stergiou",
  ),
  aut: P(
    "Marcel,Stefan,Manuel,Patrick,Christoph,Florian,Dominik,Andreas,Lukas,Matthias,Sascha,Thomas,Nico,Raphael,Simon",
    "Gruber,Huber,Wimmer,Steinbauer,Lechner,Reiter,Fuchs,Pichler,Hofer,Berger,Egger,Moser,Wieser,Baumgartner,Schlager",
  ),
  den: P(
    "Mikkel,Rasmus,Frederik,Emil,Magnus,Anders,Jonas,Nikolaj,Oliver,Kasper,Victor,Lasse,Tobias,Alexander,Mathias",
    "Nielsen,Jensen,Hansen,Andersen,Pedersen,Kristensen,Larsen,Sørensen,Poulsen,Mortensen,Bech,Skov,Vestergaard,Holm,Damsgaard",
  ),
  nor: P(
    "Sander,Kristian,Ole,Håkon,Jørgen,Mathias,Sondre,Andreas,Emil,Fredrik,Martin,Erling,Tobias,Isak,Aron",
    "Hansen,Johansen,Olsen,Larsen,Andersen,Nilsen,Berg,Haugen,Solberg,Lund,Dahl,Strand,Moe,Bakken,Vetlesen",
  ),
  swe: P(
    "Oskar,Elias,Viktor,Anton,Hugo,Filip,Axel,Melker,Isak,Gustav,Emil,Linus,Alfons,Ludvig,Noel",
    "Andersson,Johansson,Karlsson,Nilsson,Eriksson,Larsson,Olsson,Persson,Svensson,Lindberg,Bergström,Holmgren,Falk,Wahlström,Sundgren",
  ),
  pol: P(
    "Jakub,Bartosz,Kacper,Mateusz,Szymon,Filip,Michał,Piotr,Kamil,Damian,Krzysztof,Adrian,Tomasz,Wojciech,Dawid",
    "Kowalski,Nowak,Wiśniewski,Zieliński,Lewandowski,Woźniak,Kamiński,Kaczmarek,Grabowski,Pawlak,Jankowski,Szymański,Adamczyk,Sikora,Marciniak",
  ),
  ukr: P(
    "Oleksandr,Andriy,Danylo,Bohdan,Ivan,Mykola,Yehor,Vitalii,Serhii,Roman,Taras,Artem,Vladyslav,Denys,Maksym",
    "Shevchenko,Kovalenko,Bondarenko,Tkachenko,Melnyk,Kravchuk,Rudenko,Sydorenko,Zinchenko,Lysenko,Petrenko,Havrylenko,Moroz,Yaremchuk,Bondar",
  ),
  chi: P(
    "Matías,Benjamín,Cristóbal,Vicente,Ignacio,Felipe,Bastián,Nicolás,Diego,Maximiliano,Renato,Gonzalo,Esteban,Camilo,Luciano",
    "Muñoz,Contreras,Fuentes,Vargas,Aravena,Sepúlveda,Cortés,Bravo,Riquelme,Valdés,Tapia,Zúñiga,Palacios,Núñez,Galdames",
  ),
  col: P(
    "Juan,Santiago,Andrés,Camilo,Sebastián,Yerson,Jhon,Daniel,Luis,Kevin,Óscar,Steven,Cristian,Wilmar,Duván",
    "Rodríguez,Moreno,Cuadrado,Arias,Mosquera,Rincón,Zapata,Palacios,Borja,Uribe,Cardona,Quintero,Murillo,Barrios,Sinisterra",
  ),
  uru: P(
    "Facundo,Rodrigo,Mauro,Nicolás,Bruno,Federico,Emiliano,Agustín,Sebastián,Diego,Maximiliano,Gastón,Santiago,Manuel,Cristian",
    "Rodríguez,Silva,Pereira,Cavani,Núñez,Olivera,Bentancur,Viña,Cáceres,Ugarte,Rossi,Gómez,Píriz,Amaral,De la Cruz",
  ),
  aus: P(
    "Jack,Riley,Cooper,Lachlan,Zac,Connor,Harrison,Jayden,Mitchell,Angus,Bailey,Declan,Kai,Josh,Nathaniel",
    "Wilson,Thompson,Anderson,Baxter,Ryan,Coleman,Kennedy,Grant,Hudson,Fletcher,Marshall,Barnes,O'Neill,Tilio,Metcalfe",
  ),
  kor: P(
    "Min-jae,Ji-sung,Hee-chan,Seung-ho,Woo-young,Jae-sung,Kang-in,Young-jun,Tae-hwan,Dong-gyeong,Hyun-woo,Sang-ho,Jun-ho,Ui-jo,Chan-hee",
    "Kim,Lee,Park,Choi,Jung,Kang,Cho,Yoon,Jang,Lim,Han,Oh,Seo,Shin,Hwang",
  ),
  egy: P(
    "Mohamed,Ahmed,Mahmoud,Omar,Youssef,Karim,Hossam,Ramadan,Mostafa,Amr,Tarek,Emam,Zizo,Marwan,Islam",
    "Salah,Hegazi,Elneny,Abdelmonem,Fathi,Trezeguet,Sobhi,Kahraba,Shenawy,Attia,Magdy,Gabaski,Fatouh,Sherif,Zaki",
  ),
};

/** Liga -> banco de nomes (divisões inferiores herdam do país). */
const LEAGUE_TO_POOL: Record<string, string> = {
  bra2: "bra",
  eng2: "eng",
  esp2: "esp",
  ita2: "ita",
  ger2: "ger",
  fra2: "fra",
};

export function poolForLeague(leagueId: string): NamePool {
  const key = LEAGUE_TO_POOL[leagueId] ?? leagueId;
  return POOLS[key] ?? POOLS["bra"]!;
}
