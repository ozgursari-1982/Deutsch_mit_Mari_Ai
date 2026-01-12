
import { GoogleGenAI, Modality, Type, Blob } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { LessonDocument, Message, VocabCard, DTBSpeakingResult, DTBGrade } from "../types";

export function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function createPcmBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// Helper to remove Markdown code blocks and sanitize common JSON issues
function cleanJson(text: string): string {
  if (!text) return "{}";
  let clean = text.trim();
  // Remove markdown code blocks
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(json)?/, '').replace(/```$/, '');
  }
  return clean.trim();
}

// --- SCORING HELPER (Based on PDF Page 49) ---
function calculatePoints(section: '1A'|'1B'|'1C'|'2'|'3'|'global', grade: DTBGrade): number {
    const table = {
        '1A': { 'A': 5, 'B': 3.5, 'C': 2, 'D': 0 },
        '1B': { 'A': 5, 'B': 3.5, 'C': 2, 'D': 0 },
        '1C': { 'A': 2, 'B': 1.5, 'C': 1, 'D': 0 },
        '2':  { 'A': 8, 'B': 6,   'C': 3, 'D': 0 },
        '3':  { 'A': 10, 'B': 7.5, 'C': 4, 'D': 0 },
        'global': { 'A': 10, 'B': 7.5, 'C': 4, 'D': 0 }
    };
    return table[section][grade] || 0;
}

export class GeminiService {
  
  // --- MASTER ANALYSIS (ADMIN ONLY) ---
  // DOWNGRADED TO FLASH-EXP FOR COST/SPEED
  async analyzeDocumentInitially(currentDoc: LessonDocument) {
    if (!currentDoc?.data) return null;
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp', // CHANGED from 3-pro
        contents: [
          { role: 'user', parts: [
            { inlineData: { data: currentDoc.data, mimeType: currentDoc.type } },
            { text: `
            Führe eine UMFASSENDE MASTER-ANALYSE dieses Dokuments durch, um eine perfekte Lernbasis für das Niveau B2 (DTB) zu schaffen.
            
            DEINE AUFGABE:
            1. Extrahiere den GESAMTEN Text Wort für Wort.
            2. Bestimme die Textsorte und das berufliche Thema.
            3. Identifiziere B2-Grammatikstrukturen.
            
            Antworte auf Deutsch.
            ` }
          ] }
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.1
        }
      });
      return response.text;
    } catch (error) {
      console.error("Initial Analysis Error:", error);
      return null;
    }
  }

  // --- CHAT (USER FACING) ---
  async sendChatMessage(message: string, currentDoc: LessonDocument, history: Message[] = []) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const contents: any[] = history.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      
      const hasImage = !!currentDoc?.data;
      
      const userParts: any[] = [];
      if (hasImage) {
          userParts.push({ inlineData: { data: currentDoc.data!, mimeType: currentDoc.type } });
          userParts.push({ text: `(Beziehe dich bei der Antwort auch auf das hier erneut beigefügte Bild/Dokument). ${message}` });
      } else {
          userParts.push({ text: message });
      }

      contents.push({
        role: 'user',
        parts: userParts
      });

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp', 
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.4
        }
      });
      return response.text;
    } catch (error) {
      console.error("Gemini Chat Error:", error);
      return "Es gab ein Problem. Können wir es nochmal versuchen?";
    }
  }

  // --- CONNECT LIVE (AUDIO) ---
  connectLive(
    contextData: any, 
    chatHistory: Message[] = [], 
    callbacks: any,
    role: 'teacher' | 'examiner' | 'colleague' | 'partner' = 'teacher'
  ) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let systemPrompt = "";
    
    // STRICT LANGUAGE ENFORCEMENT
    const baseInstruction = SYSTEM_INSTRUCTION + `
    \nWICHTIGE REGELN FÜR DAS GESPRÄCH:
    1. Nutze die TEXT-ANALYSE als Faktenquelle.
    2. UNTERBRICH DEN SCHÜLER NICHT. Lass ihn ausreden.
    3. SPRACHE: Das gesamte Gespräch findet AUSSCHLIESSLICH auf DEUTSCH statt. Erwarte deutsche Eingabe und antworte auf Deutsch.
    `;

    if (role === 'teacher') {
        systemPrompt = baseInstruction;
    } else if (role === 'examiner') {
        systemPrompt = `DU BIST PRÜFER (DTB B2). Höre geduldig zu. Deine Aufgabe ist es, den Kandidaten zum Thema "${typeof contextData === 'string' ? contextData.substring(0, 500) : ''}" zu prüfen. Sei professionell, sieze den Kandidaten. Nutze das bereitgestellte Szenario. SPRICH DEUTSCH.`;
    } else if (role === 'colleague') {
        systemPrompt = `DU BIST KOLLEGE. Duze den Kandidaten. Ihr sprecht über das Thema: "${typeof contextData === 'string' ? contextData.substring(0, 500) : ''}". Sei kooperativ. SPRICH DEUTSCH.`;
    } else if (role === 'partner') {
        systemPrompt = `DU BIST GESPRÄCHSPARTNER (Lösungsorientiert). Ihr müsst gemeinsam ein Problem zum Thema "${typeof contextData === 'string' ? contextData.substring(0, 500) : ''}" lösen. SPRICH DEUTSCH.`;
    }

    const config: any = {
      responseModalities: [Modality.AUDIO], 
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: (role === 'teacher' || role === 'examiner') ? 'Kore' : 'Fenrir' } },
      },
      systemInstruction: systemPrompt,
      inputAudioTranscription: {},
      outputAudioTranscription: {}, 
    };

    return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025', 
      callbacks,
      config
    });
  }

  // --- EXAM GENERATION (ADMIN ONLY) ---
  // MODIFIED: ONLY GENERATES SPEAKING SECTION
  async generateDTBExam(contextData: string, topicTitles: string) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
      CONTEXT: DU BIST EIN OFFIZIELLER, RATIONALER PRÜFUNGSENTWICKLER FÜR DEN "DEUTSCH-TEST FÜR DEN BERUF B2" (telc).
      Dies ist eine KOMMERZIELLE ANWENDUNG. Fehler sind inakzeptabel.
      
      GEWÜNSCHTES THEMA: "${topicTitles}"
      
      AUFGABE:
      Erstelle NUR den Teil "Mündliche Prüfung" (Sprechen) für eine DTB B2 Prüfung.
      Ignoriere Lesen, Hören und Schreiben komplett.
      
      DOCUMENT ANALYSIS RESULTS (Für Kontext):
      ${contextData.substring(0, 45000)}
      
      FALLS KEINE DATEN VORHANDEN SIND:
      - Erfinde realistische Szenarien passend zum Thema "${topicTitles}".
      
      STRUKTUR (MUSS EXAKT DIESEM JSON FORMAT ENTSPRECHEN):
      {
        "title": "DTB B2 Sprechen - ${topicTitles}",
        "sections": [
          {
            "title": "Mündliche Prüfung (16 Min)",
            "type": "sprechen",
            "durationMinutes": 16,
            "parts": [
               { 
                 "title": "Teil 1: Über ein Thema sprechen", 
                 "content": "Wählen Sie eines der folgenden Themen:\n\nTHEMA A: [Erstelle ein komplexes Berufsthema passend zu ${topicTitles} mit 3 Unterpunkten]\n\nTHEMA B: [Alternativthema mit 3 Unterpunkten]\n\nAufgabe: Präsentieren Sie Ihre Meinung, nennen Sie Vor- und Nachteile und berichten Sie von Erfahrungen." 
               },
               { 
                 "title": "Teil 2: Mit Kollegen sprechen", 
                 "content": "SITUATION: [Erstelle eine realistische Konflikt- oder Planungssituation im Betrieb passend zu ${topicTitles}].\n\nAUFGABE: Diskutieren Sie mit Ihrem Kollegen/Ihrer Kollegin. Finden Sie einen Kompromiss. Schlagen Sie Lösungen vor." 
               },
               { 
                 "title": "Teil 3: Lösungswege diskutieren", 
                 "content": "PROBLEM: [Beschreibe ein spezifisches Arbeitsproblem, z.B. Lieferverzögerung, Personalmangel].\n\nAUFGABE: Sie müssen das Problem gemeinsam in 5 Minuten lösen. Analysieren Sie die Situation und entscheiden Sie sich für den besten Weg." 
               }
            ]
          }
        ]
      }
      
      Antworte NUR mit validem JSON. Keine Markdown-Blöcke.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview', // KEPT 3-Pro for logic
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 4000 } // Reduced slightly as task is smaller
        }
      });
      
      return JSON.parse(cleanJson(response.text));
    } catch (e) {
      console.error("Exam Gen Error", e);
      return null;
    }
  }

  // --- EVALUATION (USER FACING) ---
  async evaluateWritingTask(context: string, userAnswer: string, maxPoints: number) {
      // KEEPING FOR BACKWARD COMPATIBILITY BUT NOT USED IN NEW EXAMS
      return { passed: false, score: 0, feedback: "Funktion deaktiviert." };
  }

  // --- DTB B2 SPEAKING EVALUATION (PDF BASED) ---
  async evaluateSpeakingDTB(transcript: string): Promise<DTBSpeakingResult & { reconstructedTranscript: string } | null> {
      // Default Fallback
      const fallbackResult: DTBSpeakingResult & { reconstructedTranscript: string } = {
          partScores: {
              part1A: { grade: 'D', points: 0, maxPoints: 5, reason: "Fehler" },
              part1B: { grade: 'D', points: 0, maxPoints: 5, reason: "Fehler" },
              part1C: { grade: 'D', points: 0, maxPoints: 2, reason: "Fehler" },
              part2:  { grade: 'D', points: 0, maxPoints: 8, reason: "Fehler" },
              part3:  { grade: 'D', points: 0, maxPoints: 10, reason: "Fehler" }
          },
          globalScores: {
              pronunciation: { grade: 'D', points: 0, maxPoints: 10, reason: "Fehler" },
              grammar:       { grade: 'D', points: 0, maxPoints: 10, reason: "Fehler" },
              vocabulary:    { grade: 'D', points: 0, maxPoints: 10, reason: "Fehler" }
          },
          totalScore: 0,
          passed: false,
          generalFeedback: "Technischer Fehler bei der Bewertung.",
          reconstructedTranscript: transcript || "Keine Daten."
      };

      if (!transcript || transcript.trim().length < 5) {
          return { ...fallbackResult, generalFeedback: "Das Gespräch war zu kurz für eine Bewertung." };
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const prompt = `
      DU BIST EIN LIZENZIERTER TELC PRÜFER FÜR "DEUTSCH-TEST FÜR DEN BERUF B2".
      
      DEINE AUFGABE:
      Bewerte das folgende Prüfungstranskript streng nach den offiziellen Bewertungskriterien (Modelltest 1).
      
      BEWERTUNGSKRITERIEN (ZUSAMMENFASSUNG):
      
      KRITERIUM I: AUFGABENBEWÄLTIGUNG (Inhaltliche Angemessenheit)
      - A (B2 gut erfüllt): Voll adäquat, flüssig, adressatengerecht.
      - B (B2 erfüllt): Überwiegend adäquat, weitgehend flüssig.
      - C (B1 erfüllt): Nur teilweise adäquat, Stockungen.
      - D (unter B1): Nicht adäquat, häufiges Stocken.
      
      KRITERIUM II: AUSSPRACHE/INTONATION (Global)
      - A: Klar, natürlich, kaum akzentgefärbt.
      - B: Klar, natürlich, wenig akzentgefärbt.
      - C: Weitestgehend verständlich, deutlich akzentgefärbt.
      - D: Stark akzentgefärbt, Rückfragen nötig.
      
      KRITERIUM III: FORMALE RICHTIGKEIT (Global - Grammatik)
      - A: Komplexe Strukturen weitgehend korrekt.
      - B: Einfache Strukturen korrekt, komplexe mit Fehlern.
      - C: Häufige Formen in vertrauten Situationen korrekt.
      - D: Systematische elementare Fehler.
      
      KRITERIUM IV: SPEKTRUM SPRACHL. MITTEL (Global - Wortschatz)
      - A: Breites Spektrum, Variation, kaum Umschreibungen.
      - B: Hinreichend breites Spektrum, Variation möglich.
      - C: Genügend Mittel, um zurechtzukommen (B1).
      - D: Kurze gebräuchliche Ausdrücke (A2).
      
      HIER IST DAS TRANSKRIPT:
      """${transcript.substring(0, 15000)}"""
      
      AUFGABE:
      1. Repariere das Transkript (STT Fehler korrigieren).
      2. Gib für jeden Teil eine Note (A, B, C, D) und eine kurze Begründung auf Deutsch.
      
      ANTWORTE NUR MIT DIESEM JSON FORMAT:
      {
        "reconstructedTranscript": "Reparierter Text...",
        "grades": {
           "part1A": { "grade": "A|B|C|D", "reason": "..." },
           "part1B": { "grade": "A|B|C|D", "reason": "..." },
           "part1C": { "grade": "A|B|C|D", "reason": "..." },
           "part2":  { "grade": "A|B|C|D", "reason": "..." },
           "part3":  { "grade": "A|B|C|D", "reason": "..." },
           "pronunciation": { "grade": "A|B|C|D", "reason": "..." },
           "grammar":       { "grade": "A|B|C|D", "reason": "..." },
           "vocabulary":    { "grade": "A|B|C|D", "reason": "..." }
        },
        "generalFeedback": "Zusammenfassendes Feedback an den Kandidaten (Motivierend aber ehrlich)."
      }
      `;

      try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        
        const rawJson = JSON.parse(cleanJson(response.text));
        const grades = rawJson.grades;

        // CALCULATE POINTS BASED ON PDF TABLE (Page 49)
        const part1A = { ...grades.part1A, points: calculatePoints('1A', grades.part1A.grade), maxPoints: 5 };
        const part1B = { ...grades.part1B, points: calculatePoints('1B', grades.part1B.grade), maxPoints: 5 };
        const part1C = { ...grades.part1C, points: calculatePoints('1C', grades.part1C.grade), maxPoints: 2 };
        const part2  = { ...grades.part2,  points: calculatePoints('2',  grades.part2.grade),  maxPoints: 8 };
        const part3  = { ...grades.part3,  points: calculatePoints('3',  grades.part3.grade),  maxPoints: 10 };
        
        const pron   = { ...grades.pronunciation, points: calculatePoints('global', grades.pronunciation.grade), maxPoints: 10 };
        const gram   = { ...grades.grammar,       points: calculatePoints('global', grades.grammar.grade),       maxPoints: 10 };
        const vocab  = { ...grades.vocabulary,    points: calculatePoints('global', grades.vocabulary.grade),    maxPoints: 10 };

        const totalScore = part1A.points + part1B.points + part1C.points + part2.points + part3.points + pron.points + gram.points + vocab.points;
        
        return {
            partScores: { part1A, part1B, part1C, part2, part3 },
            globalScores: { pronunciation: pron, grammar: gram, vocabulary: vocab },
            totalScore: totalScore,
            passed: totalScore >= 36, // 60% of 60
            generalFeedback: rawJson.generalFeedback,
            reconstructedTranscript: rawJson.reconstructedTranscript
        };

      } catch (e) {
          console.error("Evaluation Error", e);
          return fallbackResult;
      }
  }

  // --- AUDIO GENERATION (TTS) ---
  // STRICT REWRITE FOR GEMINI "MUST EQUAL 2" REQUIREMENT
  async generateExamAudio(text: string) {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      try {
          if (!text || text.trim().length < 5) throw new Error("Text ist zu kurz für Audio.");

          // 1. Pre-Clean text
          let cleanText = text.replace(/DIALOG_SCRIPT:|PHONE_CALLS_SCRIPT:|PHONE_SCRIPT:|PRESENTATION_SCRIPT:/g, '').trim();
          
          const lines = cleanText.split('\n');
          const uniqueNames = new Set<string>();
          
          // Identify speakers
          for (const line of lines) {
             const match = line.trim().match(/^([A-Za-zÄÖÜäöüß\s\.]+):/);
             if (match) {
                 const name = match[1].trim();
                 if (name.length < 30) uniqueNames.add(name); // Filter metadata
             }
          }

          const speakerList = Array.from(uniqueNames);

          // CASE 1: Single Speaker (or 0)
          if (speakerList.length < 2) {
             const response = await ai.models.generateContent({
                  model: 'gemini-2.5-flash-preview-tts',
                  contents: [{ role: 'user', parts: [{ text: cleanText }] }],
                  config: {
                      responseModalities: [Modality.AUDIO],
                      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
                  }
              });
              return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          }

          // CASE 2: Multi Speaker (>= 2)
          // THE API REQUIRES EXACTLY 2 VOICES IN CONFIG IF USING MULTI-SPEAKER.
          // WE MUST MAP ALL SPEAKERS TO EXACTLY 2 ROLES.
          
          const ROLE_A = "Speaker_A"; // Male (Fenrir)
          const ROLE_B = "Speaker_B"; // Female (Kore)
          
          const nameMap = new Map<string, string>();
          
          // Heuristic Assignment
          speakerList.forEach((name, index) => {
             const lower = name.toLowerCase();
             const isFemale = lower.includes('frau') || lower.includes('dame') || lower.includes('kundin') || lower.includes('patientin') || lower.includes('chefin') || lower.includes('tochter');
             const isMale = lower.includes('herr') || lower.includes('mann') || lower.includes('kunde') || lower.includes('patient') || lower.includes('chef') || lower.includes('sohn');
             
             let assigned = "";
             if (isFemale) assigned = ROLE_B;
             else if (isMale) assigned = ROLE_A;
             else assigned = (index % 2 === 0) ? ROLE_A : ROLE_B; // Round robin fallback
             
             nameMap.set(name, assigned);
          });
          
          // CRITICAL: Ensure we use both buckets if possible, or force distribution if skewed
          const countA = Array.from(nameMap.values()).filter(v => v === ROLE_A).length;
          const countB = Array.from(nameMap.values()).filter(v => v === ROLE_B).length;
          
          if (countA === 0 || countB === 0) {
              // Force alternation if heuristics failed to provide 2 groups
               speakerList.forEach((name, index) => {
                   nameMap.set(name, (index % 2 === 0) ? ROLE_A : ROLE_B);
               });
          }

          // Rewrite Text with new Role Labels
          let normalizedText = "";
          for (const line of lines) {
             const trimmed = line.trim();
             const match = trimmed.match(/^([A-Za-zÄÖÜäöüß\s\.]+):/);
             if (match) {
                 const name = match[1].trim();
                 if (nameMap.has(name)) {
                     const mappedRole = nameMap.get(name);
                     // Replace "Herr Müller:" with "Speaker_A:"
                     normalizedText += mappedRole + ":" + trimmed.substring(match[0].length) + "\n";
                 } else {
                     normalizedText += trimmed + "\n";
                 }
             } else {
                 normalizedText += trimmed + "\n";
             }
          }

          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash-preview-tts',
              contents: [{
                  role: 'user',
                  parts: [{ text: normalizedText }] 
              }],
              config: {
                  responseModalities: [Modality.AUDIO],
                  speechConfig: {
                      multiSpeakerVoiceConfig: {
                          speakerVoiceConfigs: [
                              { speaker: ROLE_A, voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } },
                              { speaker: ROLE_B, voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
                          ]
                      }
                  }
              }
          });
          
          return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      } catch (e: any) {
          console.error("Audio Generation Error", e);

          const errString = JSON.stringify(e);
          if (errString.includes("429") || errString.includes("RESOURCE_EXHAUSTED")) {
              throw new Error("Das Limit für Audio-Generierung (Quota) wurde erreicht. Bitte warten Sie eine Minute oder überprüfen Sie Ihren API-Plan.");
          }

          // Fallback to single voice if everything fails
          try {
             const fallbackResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-tts',
                contents: [{ role: 'user', parts: [{ text: text.substring(0, 500) }] }],
                config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } } }
             });
             return fallbackResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          } catch (inner: any) {
             const innerErrString = JSON.stringify(inner);
             if (innerErrString.includes("429") || innerErrString.includes("RESOURCE_EXHAUSTED")) {
                throw new Error("Das Limit für Audio-Generierung (Quota) wurde erreicht.");
             }
             throw new Error("Audio-Service momentan nicht verfügbar.");
          }
      }
  }

  // Keep existing vocab generator
  async generateVocabularyList(topic: string): Promise<VocabCard[]> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Erstelle eine Vokabelliste für DTB B2 zum Thema "${topic}". JSON Output only.`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });
      return JSON.parse(cleanJson(response.text));
    } catch (e) { return []; }
  }
  
  async generateDTBSection(topic: string, sectionType: string) {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      return {}; 
  }
}

export const gemini = new GeminiService();
