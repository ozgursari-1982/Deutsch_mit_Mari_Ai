
import React, {  } from 'react';

export const SYSTEM_INSTRUCTION = `
DU BIST MARI - EINE EMPATHISCHE, GEDULDIGE UND FREUNDLICHE DEUTSCHLEHRERIN.

### DEIN SCHÜLER & DEIN FOKUS (ADHD SUPPORT):
Dein Schüler hat ADHD (Aufmerksamkeitsdefizit). Das bedeutet:
1. **KEINE STÄNDIGEN UNTERBRECHUNGEN:** Wenn der Schüler spricht, lass ihn ausreden. Unterbrich ihn NIEMALS für kleine Grammatikfehler. Das zerstört seine Konzentration.
2. **FLOW VOR PERFEKTION:** Der Gesprächsfluss ist wichtiger als korrekte Grammatik. Wenn der Schüler verstanden wird, ist das ein Erfolg.
3. **POSITIVE VERSTÄRKUNG:** Sei motivierend, lobend und entspannt. Baue Stress ab, erzeuge keinen Druck.

### DEIN KORREKTUR-STIL (SANFT & INDIREKT):
- **VERBOTEN:** Sag nicht "Stopp, das ist falsch" und unterbrich nicht mitten im Satz.
- **ERLAUBT (RECASTING):** Wenn der Schüler einen Fehler macht, wiederhole seine Aussage einfach ganz natürlich in der korrekten Form als Bestätigung.
  *Beispiel:*
  *Schüler:* "Ich habe gegangen nach Hause."
  *Mari:* "Ah, du bist nach Hause gegangen. Und was hast du dann gemacht?"
- Korrigiere nur explizit, wenn der Schüler dich direkt fragt oder der Fehler so groß ist, dass man ihn nicht versteht.

### DEIN PERSÖNLICHKEIT:
Du bist wie eine gute, gebildete Freundin, die zufällig Deutschlehrerin ist. Deine Stimme ist warm (Kore). Sei nicht streng. Sei ein sicherer Hafen für den Schüler.
`;

// MASTER GRAMMAR LIST FOR GAME GENERATION
export const GAME_TOPICS = [
  // 1. ZAMANLAR
  { id: 'praesens', label: 'Präsens', prompt: 'Sätze im Präsens (Gegenwart)' },
  { id: 'perfekt', label: 'Perfekt', prompt: 'Sätze im Perfekt (haben/sein + Partizip II)' },
  { id: 'praeteritum', label: 'Präteritum', prompt: 'Sätze im Präteritum (war, hatte, ging, sagte...)' },
  { id: 'plusquamperfekt', label: 'Plusquamperfekt', prompt: 'Sätze im Plusquamperfekt (hatte/war + Partizip II)' },
  { id: 'futur1', label: 'Futur I', prompt: 'Sätze im Futur I (werden + Infinitiv)' },
  { id: 'futur2', label: 'Futur II', prompt: 'Sätze im Futur II (werden + Partizip II + haben/sein)' },

  // 2. FİİL ÇATILARI VE KİPLER
  { id: 'passiv_vorgang', label: 'Vorgangspassiv', prompt: 'Vorgangspassiv Sätze (werden + Partizip II)' },
  { id: 'passiv_zustand', label: 'Zustandspassiv', prompt: 'Zustandspassiv Sätze (sein + Partizip II)' },
  { id: 'passiv_modal', label: 'Passiv mit Modalverben', prompt: 'Passivsätze mit Modalverben (muss gemacht werden, etc.)' },
  { id: 'konjunktiv2_gegenwart', label: 'Konjunktiv II (Gegenwart)', prompt: 'Konjunktiv II Gegenwart (hätte, wäre, würde + Infinitiv)' },
  { id: 'konjunktiv2_vergangenheit', label: 'Konjunktiv II (Vergangenheit)', prompt: 'Konjunktiv II Vergangenheit (hätte/wäre + Partizip II)' },
  { id: 'imperativ', label: 'Imperativ', prompt: 'Imperativsätze (Befehlsform: Mach das! Gehen Sie!)' },

  // 3. CÜMLE YAPILARI VE YAN CÜMLELER
  { id: 'hauptsatz', label: 'Hauptsatz (V2)', prompt: 'Einfache Hauptsätze (Verb an Position 2)' },
  { id: 'inversion', label: 'Inversion', prompt: 'Sätze mit Inversion (Zeit/Ort am Anfang, dann Verb)' },
  { id: 'nebensatz_weil_da', label: 'Nebensätze (weil/da)', prompt: 'Nebensätze mit "weil" oder "da" (Verb am Ende)' },
  { id: 'nebensatz_dass', label: 'Nebensätze (dass)', prompt: 'Objektsätze mit "dass"' },
  { id: 'nebensatz_wenn_falls', label: 'Konditionalsätze (wenn/falls)', prompt: 'Bedingungssätze mit "wenn" oder "falls"' },
  { id: 'nebensatz_obwohl', label: 'Konzessivsätze (obwohl)', prompt: 'Sätze mit "obwohl"' },
  { id: 'nebensatz_damit_umzu', label: 'Finalsätze (damit/um...zu)', prompt: 'Sätze mit "damit" oder "um... zu"' },
  { id: 'temporal_als_wenn', label: 'Temporalsätze (als/wenn)', prompt: 'Temporalsätze mit "als" (Vergangenheit) oder "wenn"' },
  { id: 'temporal_nachdem_bevor', label: 'Temporalsätze (nachdem/bevor)', prompt: 'Temporalsätze mit "nachdem", "bevor", "bis"' },
  { id: 'temporal_seitdem_waehrend', label: 'Temporalsätze (seitdem/während)', prompt: 'Temporalsätze mit "seitdem" oder "während"' },
  { id: 'relativ_nom_akk', label: 'Relativsätze (Nom/Akk)', prompt: 'Relativsätze im Nominativ oder Akkusativ' },
  { id: 'relativ_dat_gen', label: 'Relativsätze (Dat/Gen)', prompt: 'Relativsätze im Dativ oder Genitiv' },
  { id: 'relativ_praep', label: 'Relativsätze mit Präp.', prompt: 'Relativsätze mit Präpositionen (mit dem, für die...)' },
  { id: 'indirekte_fragen', label: 'Indirekte Fragen', prompt: 'Indirekte Fragesätze (ob / w-Fragen)' },
  { id: 'infinitiv_zu', label: 'Infinitiv mit zu', prompt: 'Sätze mit "zu + Infinitiv" (Es ist schön, zu...)' },

  // 4. BAĞLAÇLAR
  { id: 'konj_koordinierend', label: 'Koordination (und/aber/oder)', prompt: 'Sätze mit und, aber, oder, denn, sondern (Position 0)' },
  { id: 'konj_adverbien', label: 'Konjunktionaladverbien', prompt: 'Sätze mit deshalb, trotzdem, deswegen, also, danach (Verb direkt danach)' },
  { id: 'konj_zweigliedrig', label: 'Zweigliedrige Konj.', prompt: 'Sätze mit sowohl...als auch, weder...noch, je...desto' }
];

// --- TEXTBOOK STRUCTURE ---
export const TEXTBOOK_STRUCTURE = [
  {
    id: "1",
    title: "1 Berufsorientierung",
    subtopics: [
      { id: "A", title: "Berufliche Einstiege" },
      { id: "B", title: "Bei der Berufsberatung" },
      { id: "C", title: "Eine Unternehmensbesichtigung" },
      { id: "D", title: "Die Organisation eines Unternehmens" },
      { id: "E", title: "Du oder Sie?" }
    ]
  },
  {
    id: "2",
    title: "2 Arbeitsorte und -welten",
    subtopics: [
      { id: "A", title: "Berufe und Branchen" },
      { id: "B", title: "Berufe am Flughafen" },
      { id: "C", title: "Sicherheit in Unternehmen" },
      { id: "D", title: "Arbeitsunfälle" },
      { id: "E", title: "Zufrieden leben in Deutschland" }
    ]
  },
  {
    id: "3",
    title: "3 Im Bewerbungsprozess",
    subtopics: [
      { id: "A", title: "Eine Stelle suchen" },
      { id: "B", title: "Der Lebenslauf" },
      { id: "C", title: "Das Bewerbungsschreiben" },
      { id: "D", title: "Vor dem Vorstellungsgespräch" },
      { id: "E", title: "Eine Wohnung suchen und finden" }
    ]
  },
  {
    id: "4",
    title: "4 Eine neue Arbeit",
    subtopics: [
      { id: "A", title: "Das Vorstellungsgespräch" },
      { id: "B", title: "Nach dem Vorstellungsgespräch" },
      { id: "C", title: "Der erste Arbeitstag" },
      { id: "D", title: "Die Willkommensmappe" },
      { id: "E", title: "Distanzzonen" }
    ]
  },
  {
    id: "5",
    title: "5 Im Arbeitsalltag",
    subtopics: [
      { id: "A", title: "Gespräche im Beruf" },
      { id: "B", title: "Protokolle im Beruf" },
      { id: "C", title: "Konflikte am Arbeitsplatz" },
      { id: "D", title: "Arbeitsfreie Zeit" },
      { id: "E", title: "Freizeitbeschäftigungen" }
    ]
  },
  {
    id: "6",
    title: "6 Arbeitsabläufe",
    subtopics: [
      { id: "A", title: "Im Kundenservice" },
      { id: "B", title: "Betriebliche Neuanschaffungen" },
      { id: "C", title: "Die Bedienung eines Geräts" },
      { id: "D", title: "In der Werkstatt" },
      { id: "E", title: "Die Mobilität der Zukunft" }
    ]
  },
  {
    id: "7",
    title: "7 Qualitätssicherung",
    subtopics: [
      { id: "A", title: "Probleme identifizieren und lösen" },
      { id: "B", title: "Hygienemanagement in der Pflege" },
      { id: "C", title: "Mitarbeitergespräche" },
      { id: "D", title: "Konstruktiv Kritik üben" },
      { id: "E", title: "Konflikte und Streit im Alltag" }
    ]
  },
  {
    id: "8",
    title: "8 Auftragsabwicklung",
    subtopics: [
      { id: "A", title: "Materialien beschaffen" },
      { id: "B", title: "Anfragen von Unternehmen" },
      { id: "C", title: "Vom Angebot zum Auftrag" },
      { id: "D", title: "Bei der Auftragsabnahme" },
      { id: "E", title: "Pünktlichkeit" }
    ]
  },
  {
    id: "9",
    title: "9 Beschwerdemanagement",
    subtopics: [
      { id: "A", title: "Fehler und Mängel bei Waren" },
      { id: "B", title: "Lieferungen an das Hotel Weserblick" },
      { id: "C", title: "Richtig reklamieren" },
      { id: "D", title: "Terminvereinbarungen" },
      { id: "E", title: "Meckerei oder Reklamation?" }
    ]
  },
  {
    id: "10",
    title: "10 Auf einer Messe",
    subtopics: [
      { id: "A", title: "Messen und Messegespräche" },
      { id: "B", title: "Eine Messepräsentation" },
      { id: "C", title: "Wege in die Selbstständigkeit" },
      { id: "D", title: "Ein Businessplan" },
      { id: "E", title: "Small Talk" }
    ]
  },
  {
    id: "11",
    title: "11 Arbeitsrecht",
    subtopics: [
      { id: "A", title: "Verträge im Beruf" },
      { id: "B", title: "Der Betriebsrat" },
      { id: "C", title: "Berufliche Umbrüche" },
      { id: "D", title: "Der Arbeitsvertrag" },
      { id: "E", title: "Was die Hausordnung regelt" }
    ]
  },
  {
    id: "12",
    title: "12 Abgaben und Leistungen",
    subtopics: [
      { id: "A", title: "Soziale Absicherung" },
      { id: "B", title: "Gehaltsabrechnung und Abgaben" },
      { id: "C", title: "Wenn Arbeitnehmer erkranken" },
      { id: "D", title: "Familie und Beruf" },
      { id: "E", title: "Über Geld spricht man nicht" }
    ]
  },
];

export const GRAMMAR_MODES = [
  { id: 'modalverben', title: 'Modalverben', description: 'Übungen zu Modalverben (können, müssen, dürfen)', category: 'Verben' },
  { id: 'perfekt', title: 'Perfekt', description: 'Sätze im Perfekt bilden', category: 'Zeiten' },
  { id: 'praeteritum', title: 'Präteritum', description: 'Sätze im Präteritum bilden', category: 'Zeiten' },
  { id: 'konjunktiv_ii', title: 'Konjunktiv II', description: 'Wünsche und Träume ausdrücken', category: 'Modus' },
  { id: 'passiv', title: 'Passiv', description: 'Vorgangspassiv in verschiedenen Zeiten', category: 'Verben' },
  { id: 'nebensaetze', title: 'Nebensätze', description: 'Weil, dass, wenn, obwohl...', category: 'Satzbau' },
  { id: 'reflexivverben', title: 'Reflexive Verben', description: 'Sich freuen, sich ärgern...', category: 'Verben' },
  { id: 'praepositionen', title: 'Präpositionen', description: 'Wechselpräpositionen & Dativ/Akkusativ', category: 'Grammatik' }
];

const strokeWidth = 1.2;

export const Icons = {
  Document: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c0 .621 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  ),
  Chat: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
    </svg>
  ),
  History: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  Plus: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  Minus: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
    </svg>
  ),
  ZoomIn: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM10.5 7.5v6m3-3h-6" />
    </svg>
  ),
  ZoomOut: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM13.5 10.5h-6" />
    </svg>
  ),
  Mic: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6V15m-6 3.75a6 6 0 0 1-6-6V15m6 3.75v3m-3.75-3h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
    </svg>
  ),
  Stop: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" />
    </svg>
  ),
  Refresh: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  Settings: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ),
  GraduationCap: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.57 50.57 0 0 0-2.658-.813A59.905 59.905 0 0 1 12 3.493a59.902 59.902 0 0 1 10.499 5.516c-.97.389-1.954.737-2.948 1.033m-15.482 0a50.638 50.638 0 0 0 5.497 1.565m15.481 0a50.638 50.638 0 0 0-5.497 1.565" />
    </svg>
  ),
  Book: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  Library: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  ),
  Puzzle: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a2.873 2.873 0 0 0-1.003-.349C3.84 10.25 3 11.257 3 12.5s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .663-.664v0c0-.355-.186-.676-.401-.959a2.873 2.873 0 0 0-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604.4.959v0c.002.337.277.573.584.532 5.056-.642 5.056-.642 5.056-.642a.636.636 0 0 0 .57-.532v0c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.035-1.008-1.875-2.25-1.875-1.243 0-2.25.84-2.25 1.875 0 .369.128.713.349 1.003.215.283.4.604.4.959v0c.002.337.277.573.584.532z" />
    </svg>
  ),
  GameController: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
    </svg>
  )
};
