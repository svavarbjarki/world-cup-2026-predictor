// World Cup 2026: top 3 players per team, for display under each team while users
// predict (to convey team strength at a glance).
//
// IMPORTANT - DATA STATUS
// All 48 final 26-man squads were officially confirmed by FIFA on 2 June 2026, so
// every name here is verifiable against a real squad. Sources cross-referenced:
// ESPN, Al Jazeera, Sky Sports, Yahoo Sports, Olympics.com (all post-2-June official
// squad lists).
//
// "Top 3" = the three most prominent / highest-profile players in that nation's
// CONFIRMED squad (by reputation and squad value), chosen to give a quick sense of
// team strength. It is a judgement call, not an official ranking. Every player listed
// is in the final squad.
//
// COVERAGE: all 48 teams are filled and marked status:"confirmed", verified from the
// official post-2-June squad lists. The status field and empty-list handling are kept
// in the type so the UI degrades gracefully if an entry is ever cleared or a new team
// is added. Do NOT invent names for any future "todo" teams; source them.
//
// Team names MUST match the `name` values in teams.ts exactly.

export type TopPlayer = {
  name: string;
  position: "GK" | "DF" | "MF" | "FW";
};

export type TeamTop3 = {
  team: string;             // must match teams.ts
  status: "confirmed" | "todo";
  players: TopPlayer[];     // up to 3; may be empty for "todo"
};

export const TEAM_TOP3: TeamTop3[] = [
  // ===== Confirmed from official squads =====

  { team: "France", status: "confirmed", players: [
    { name: "Kylian Mbappé", position: "FW" },
    { name: "Ousmane Dembélé", position: "FW" },
    { name: "Michael Olise", position: "MF" },
  ]},
  { team: "England", status: "confirmed", players: [
    { name: "Jude Bellingham", position: "MF" },
    { name: "Harry Kane", position: "FW" },
    { name: "Bukayo Saka", position: "FW" },
  ]},
  { team: "Spain", status: "confirmed", players: [
    { name: "Lamine Yamal", position: "FW" },
    { name: "Pedri", position: "MF" },
    { name: "Rodri", position: "MF" },
  ]},
  { team: "Germany", status: "confirmed", players: [
    { name: "Florian Wirtz", position: "MF" },
    { name: "Jamal Musiala", position: "MF" },
    { name: "Kai Havertz", position: "FW" },
  ]},
  { team: "Portugal", status: "confirmed", players: [
    { name: "Cristiano Ronaldo", position: "FW" },
    { name: "Bruno Fernandes", position: "MF" },
    { name: "Rúben Dias", position: "DF" },
  ]},
  { team: "Brazil", status: "confirmed", players: [
    { name: "Vinícius Júnior", position: "FW" },
    { name: "Neymar", position: "FW" },
    { name: "Alisson", position: "GK" },
  ]},
  { team: "Argentina", status: "confirmed", players: [
    { name: "Lionel Messi", position: "FW" },
    { name: "Lautaro Martínez", position: "FW" },
    { name: "Emiliano Martínez", position: "GK" },
  ]},
  { team: "Netherlands", status: "confirmed", players: [
    { name: "Virgil van Dijk", position: "DF" },
    { name: "Memphis Depay", position: "FW" },
    { name: "Cody Gakpo", position: "FW" },
  ]},
  { team: "Norway", status: "confirmed", players: [
    { name: "Erling Haaland", position: "FW" },
    { name: "Martin Ødegaard", position: "MF" },
    { name: "Antonio Nusa", position: "FW" },
  ]},
  { team: "Switzerland", status: "confirmed", players: [
    { name: "Granit Xhaka", position: "MF" },
    { name: "Manuel Akanji", position: "DF" },
    { name: "Gregor Kobel", position: "GK" },
  ]},
  { team: "United States", status: "confirmed", players: [
    { name: "Christian Pulisic", position: "FW" },
    { name: "Weston McKennie", position: "MF" },
    { name: "Tyler Adams", position: "MF" },
  ]},
  { team: "Canada", status: "confirmed", players: [
    { name: "Alphonso Davies", position: "DF" },
    { name: "Jonathan David", position: "FW" },
    { name: "Stephen Eustáquio", position: "MF" },
  ]},
  { team: "Mexico", status: "confirmed", players: [
    { name: "Edson Álvarez", position: "MF" },
    { name: "Johan Vásquez", position: "DF" },
    { name: "Guillermo Ochoa", position: "GK" },
  ]},
  { team: "Sweden", status: "confirmed", players: [
    { name: "Alexander Isak", position: "FW" },
    { name: "Viktor Gyökeres", position: "FW" },
    { name: "Anthony Elanga", position: "FW" },
  ]},
  { team: "South Korea", status: "confirmed", players: [
    { name: "Kim Min-jae", position: "DF" },
    { name: "Lee Kang-in", position: "MF" },
    { name: "Hwang Hee-chan", position: "FW" },
  ]},

  { team: "Belgium", status: "confirmed", players: [
    { name: "Kevin De Bruyne", position: "MF" },
    { name: "Thibaut Courtois", position: "GK" },
    { name: "Romelu Lukaku", position: "FW" },
  ]},
  { team: "Croatia", status: "confirmed", players: [
    { name: "Luka Modrić", position: "MF" },
    { name: "Joško Gvardiol", position: "DF" },
    { name: "Mateo Kovačić", position: "MF" },
  ]},
  { team: "Senegal", status: "confirmed", players: [
    { name: "Nicolas Jackson", position: "FW" },
    { name: "Kalidou Koulibaly", position: "DF" },
    { name: "Pape Matar Sarr", position: "MF" },
  ]},
  { team: "Morocco", status: "confirmed", players: [
    { name: "Achraf Hakimi", position: "DF" },
    { name: "Youssef En-Nesyri", position: "FW" },
    { name: "Brahim Díaz", position: "MF" },
  ]},
  { team: "Czechia", status: "confirmed", players: [
    { name: "Patrik Schick", position: "FW" },
    { name: "Tomáš Souček", position: "MF" },
    { name: "Ladislav Krejčí", position: "DF" },
  ]},
  { team: "Türkiye", status: "confirmed", players: [
    { name: "Arda Güler", position: "MF" },
    { name: "Hakan Çalhanoğlu", position: "MF" },
    { name: "Kenan Yıldız", position: "FW" },
  ]},
  { team: "Japan", status: "confirmed", players: [
    { name: "Kaoru Mitoma", position: "FW" },
    { name: "Wataru Endo", position: "MF" },
    { name: "Daichi Kamada", position: "MF" },
  ]},
  { team: "Australia", status: "confirmed", players: [
    { name: "Mathew Ryan", position: "GK" },
    { name: "Mathew Leckie", position: "FW" },
    { name: "Connor Metcalfe", position: "MF" },
  ]},
  { team: "Uruguay", status: "confirmed", players: [
    { name: "Federico Valverde", position: "MF" },
    { name: "Darwin Núñez", position: "FW" },
    { name: "Ronald Araújo", position: "DF" },
  ]},
  { team: "Colombia", status: "confirmed", players: [
    { name: "Luis Díaz", position: "FW" },
    { name: "James Rodríguez", position: "MF" },
    { name: "Jhon Durán", position: "FW" },
  ]},
  { team: "Ecuador", status: "confirmed", players: [
    { name: "Moisés Caicedo", position: "MF" },
    { name: "Enner Valencia", position: "FW" },
    { name: "Pervis Estupiñán", position: "DF" },
  ]},
  { team: "Cote d'Ivoire", status: "confirmed", players: [
    { name: "Sébastien Haller", position: "FW" },
    { name: "Franck Kessié", position: "MF" },
    { name: "Simon Adingra", position: "FW" },
  ]},
  { team: "Scotland", status: "confirmed", players: [
    { name: "Andy Robertson", position: "DF" },
    { name: "Scott McTominay", position: "MF" },
    { name: "John McGinn", position: "MF" },
  ]},
  { team: "Bosnia and Herzegovina", status: "confirmed", players: [
    { name: "Edin Džeko", position: "FW" },
    { name: "Sead Kolašinac", position: "DF" },
    { name: "Amar Dedić", position: "DF" },
  ]},

  { team: "Egypt", status: "confirmed", players: [
    { name: "Mohamed Salah", position: "FW" },
    { name: "Omar Marmoush", position: "FW" },
    { name: "Mohamed Elneny", position: "MF" },
  ]},
  { team: "Algeria", status: "confirmed", players: [
    { name: "Riyad Mahrez", position: "FW" },
    { name: "Amine Gouiri", position: "FW" },
    { name: "Mohamed Amine Amoura", position: "FW" },
  ]},
  { team: "Iran", status: "confirmed", players: [
    { name: "Mehdi Taremi", position: "FW" },
    { name: "Sardar Azmoun", position: "FW" },
    { name: "Alireza Beiranvand", position: "GK" },
  ]},
  { team: "Austria", status: "confirmed", players: [
    { name: "Marcel Sabitzer", position: "MF" },
    { name: "Konrad Laimer", position: "MF" },
    { name: "Marko Arnautović", position: "FW" },
  ]},
  { team: "Saudi Arabia", status: "confirmed", players: [
    { name: "Salem Al-Dawsari", position: "FW" },
    { name: "Firas Al-Buraikan", position: "FW" },
    { name: "Mohammed Kanno", position: "MF" },
  ]},
  { team: "Paraguay", status: "confirmed", players: [
    { name: "Miguel Almirón", position: "MF" },
    { name: "Gustavo Gómez", position: "DF" },
    { name: "Julio Enciso", position: "FW" },
  ]},
  { team: "Ghana", status: "confirmed", players: [
    { name: "Mohammed Kudus", position: "MF" },
    { name: "Thomas Partey", position: "MF" },
    { name: "Antoine Semenyo", position: "FW" },
  ]},

  { team: "Tunisia", status: "confirmed", players: [
    { name: "Hannibal Mejbri", position: "MF" },
    { name: "Ellyes Skhiri", position: "MF" },
    { name: "Montassar Talbi", position: "DF" },
  ]},
  { team: "Qatar", status: "confirmed", players: [
    { name: "Akram Afif", position: "FW" },
    { name: "Almoez Ali", position: "FW" },
    { name: "Hassan Al-Haydos", position: "MF" },
  ]},
  { team: "Jordan", status: "confirmed", players: [
    { name: "Musa Al-Tamari", position: "FW" },
    { name: "Yazan Al-Naimat", position: "FW" },
    { name: "Noor Al-Rawabdeh", position: "MF" },
  ]},
  { team: "New Zealand", status: "confirmed", players: [
    { name: "Chris Wood", position: "FW" },
    { name: "Marko Stamenic", position: "MF" },
    { name: "Tyler Bindon", position: "DF" },
  ]},

  { team: "South Africa", status: "confirmed", players: [
    { name: "Ronwen Williams", position: "GK" },
    { name: "Teboho Mokoena", position: "MF" },
    { name: "Lyle Foster", position: "FW" },
  ]},
  { team: "Cabo Verde", status: "confirmed", players: [
    { name: "Ryan Mendes", position: "FW" },
    { name: "Logan Costa", position: "DF" },
    { name: "Jamiro Monteiro", position: "MF" },
  ]},
  { team: "DR Congo", status: "confirmed", players: [
    { name: "Yoane Wissa", position: "FW" },
    { name: "Chancel Mbemba", position: "DF" },
    { name: "Aaron Wan-Bissaka", position: "DF" },
  ]},
  { team: "Uzbekistan", status: "confirmed", players: [
    { name: "Abdukodir Khusanov", position: "DF" },
    { name: "Eldor Shomurodov", position: "FW" },
    { name: "Jaloliddin Masharipov", position: "MF" },
  ]},
  { team: "Iraq", status: "confirmed", players: [
    { name: "Aymen Hussein", position: "FW" },
    { name: "Zidane Iqbal", position: "MF" },
    { name: "Ali Jasim", position: "FW" },
  ]},
  { team: "Curacao", status: "confirmed", players: [
    { name: "Tahith Chong", position: "MF" },
    { name: "Juninho Bacuna", position: "MF" },
    { name: "Jurgen Locadia", position: "FW" },
  ]},
  { team: "Haiti", status: "confirmed", players: [
    { name: "Frantzdy Pierrot", position: "FW" },
    { name: "Danley Jean Jacques", position: "MF" },
    { name: "Johnny Placide", position: "GK" },
  ]},
  { team: "Panama", status: "confirmed", players: [
    { name: "Adalberto Carrasquilla", position: "MF" },
    { name: "Ismael Díaz", position: "FW" },
    { name: "Cecilio Waterman", position: "FW" },
  ]},
];
