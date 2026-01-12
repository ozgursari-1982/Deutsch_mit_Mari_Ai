
import React, { useState, useRef } from 'react';
import { TEXTBOOK_STRUCTURE, Icons } from '../constants';
import { LessonDocument } from '../types';

interface Props {
  documents: LessonDocument[];
  onOpenDocument: (doc: LessonDocument) => void;
  isAdmin: boolean;
  onUploadToCategory: (file: File, themeId: string, subtopicId: string) => void;
  isUploading: boolean;
}

const LibraryView: React.FC<Props> = ({ 
  documents, 
  onOpenDocument, 
  isAdmin, 
  onUploadToCategory,
  isUploading 
}) => {
  const [expandedTheme, setExpandedTheme] = useState<string | null>(null);
  const [expandedSubtopic, setExpandedSubtopic] = useState<string | null>(null);
  
  // Ref for the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{themeId: string, subtopicId: string} | null>(null);

  const toggleTheme = (id: string) => {
    setExpandedTheme(expandedTheme === id ? null : id);
    setExpandedSubtopic(null); // Reset subtopic when changing theme
  };

  const toggleSubtopic = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedSubtopic(expandedSubtopic === id ? null : id);
  };

  const handleUploadClick = (e: React.MouseEvent, themeId: string, subtopicId: string) => {
    e.stopPropagation();
    setUploadTarget({ themeId, subtopicId });
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && uploadTarget) {
      onUploadToCategory(e.target.files[0], uploadTarget.themeId, uploadTarget.subtopicId);
      // Reset after selection
      e.target.value = '';
      setUploadTarget(null);
    }
  };

  return (
    <div className="h-full bg-white overflow-y-auto custom-scrollbar">
      <div className="max-w-4xl mx-auto p-8 pb-32">
        <h2 className="text-2xl font-black text-slate-900 mb-2">Bibliothek</h2>
        <p className="text-slate-500 mb-8">Wählen Sie ein Thema, um Lernmaterialien anzuzeigen.</p>
        
        {/* HIDDEN INPUT FOR ADMIN UPLOAD */}
        {isAdmin && (
           <input 
             ref={fileInputRef} 
             type="file" 
             accept="image/*" 
             className="hidden" 
             onChange={onFileChange} 
           />
        )}

        <div className="space-y-4">
          {TEXTBOOK_STRUCTURE.map((theme) => {
            const isThemeOpen = expandedTheme === theme.id;
            
            return (
              <div key={theme.id} className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm transition-all">
                {/* THEME HEADER */}
                <button 
                  onClick={() => toggleTheme(theme.id)}
                  className={`w-full text-left p-6 flex items-center justify-between transition-colors ${isThemeOpen ? 'bg-slate-50' : 'bg-white hover:bg-slate-50/50'}`}
                >
                  <span className={`font-bold text-lg ${isThemeOpen ? 'text-indigo-900' : 'text-slate-800'}`}>
                    {theme.title}
                  </span>
                  <div className={`transition-transform duration-300 ${isThemeOpen ? 'rotate-180' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </button>

                {/* SUBTOPICS */}
                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isThemeOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="p-4 space-y-2 bg-slate-50 border-t border-slate-100">
                    {theme.subtopics.map((sub) => {
                      const isSubOpen = expandedSubtopic === sub.id;
                      // Filter docs for this specific slot
                      const subDocs = documents.filter(d => d.themeId === theme.id && d.subtopicId === sub.id);
                      
                      return (
                        <div key={sub.id} className="bg-white rounded-xl border border-slate-200/50">
                          {/* SUBTOPIC HEADER */}
                          <div 
                             onClick={(e) => toggleSubtopic(e, sub.id)}
                             className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded-xl transition-colors"
                          >
                             <div className="flex items-center gap-3">
                               <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${isSubOpen ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                                 {sub.id}
                               </div>
                               <span className={`font-medium ${isSubOpen ? 'text-indigo-900' : 'text-slate-700'}`}>
                                 {sub.title}
                               </span>
                               <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                                 {subDocs.length}
                               </span>
                             </div>

                             {/* ADMIN UPLOAD BUTTON - ONLY FOR ADMIN */}
                             {isAdmin && (
                               <button
                                 onClick={(e) => handleUploadClick(e, theme.id, sub.id)}
                                 disabled={isUploading}
                                 className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-400 transition-all shadow-sm active:scale-95"
                                 title="Dokument hier hochladen"
                               >
                                  {isUploading && uploadTarget?.themeId === theme.id && uploadTarget?.subtopicId === sub.id ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                  ) : (
                                    <Icons.Plus className="w-5 h-5" />
                                  )}
                               </button>
                             )}
                          </div>

                          {/* DOCUMENTS LIST */}
                          {isSubOpen && (
                             <div className="border-t border-slate-100 p-2 pl-14 bg-[#FDFDFD] space-y-2 animate-fade-in">
                               {subDocs.length === 0 ? (
                                 <div className="py-4 text-xs text-slate-400 italic">
                                   Noch keine Dokumente in diesem Bereich.
                                 </div>
                               ) : (
                                 subDocs.map((doc) => (
                                   <div 
                                     key={doc.id}
                                     onClick={() => onOpenDocument(doc)}
                                     className="flex items-center gap-3 p-3 rounded-lg hover:bg-white hover:shadow-md hover:scale-[1.01] transition-all cursor-pointer border border-transparent hover:border-slate-100 group"
                                   >
                                      {/* Thumbnail Preview */}
                                      <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                                         {doc.imageUrl ? (
                                            <img src={doc.imageUrl} className="w-full h-full object-cover" alt="prev" />
                                         ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                               <Icons.Document className="w-5 h-5 text-slate-300" />
                                            </div>
                                         )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-700 truncate group-hover:text-indigo-700 transition-colors">
                                           {doc.name}
                                        </p>
                                        <p className="text-[10px] text-slate-400">
                                           Hinzugefügt am {new Date(doc.timestamp).toLocaleDateString()}
                                        </p>
                                      </div>
                                   </div>
                                 ))
                               )}
                             </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LibraryView;
