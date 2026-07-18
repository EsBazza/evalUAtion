import { useState } from 'react';
import Link from 'next/link';

interface FooterProps {
  className?: string;
}

export function Footer({ className = "" }: FooterProps) {
  const [showQualityModal, setShowQualityModal] = useState(false);

  const developers = [
    "ALONZO",
    "ALEJOS",
    "DELA PEÑA",
    "GALANG",
    "LULU",
    "PASTORAL",
    "SIMEON"
  ];

  return (
    <footer className={`bg-ua-blue text-white border-t border-ua-blue-dark/40 pt-10 pb-6 px-6 sm:px-8 space-y-8 ${className}`}>
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        
        {/* Column 1: Institutional Branding */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <img 
              src="/ua-logo.png" 
              alt="UA Logo" 
              className="w-12 h-12 object-contain rounded-full" 
            />
            <img 
              src="/cit-logo.png" 
              alt="CIT Seal" 
              className="w-[60px] h-[60px] object-contain rounded-full" 
            />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-black tracking-widest text-ua-gold uppercase">University of the Assumption</h4>
            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">College of Information Technology</p>
          </div>
        </div>

        {/* Column 2: CONNECT */}
        <div className="space-y-3">
          <h4 className="text-xs font-black tracking-widest text-slate-200 uppercase">Connect</h4>
          <ul className="space-y-2.5 text-xs font-semibold text-slate-300">
            <li>
              <a 
                href="https://www.facebook.com/universityoftheassumption" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="group flex items-center gap-2 hover:text-ua-gold transition-colors duration-150"
              >
                <svg className="w-4 h-4 shrink-0 text-slate-300 group-hover:text-ua-gold transition-colors fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/>
                </svg>
                <span>universityoftheassumption</span>
              </a>
            </li>
            <li>
              <a 
                href="https://web.ua.edu.ph/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="group flex items-center gap-2 hover:text-ua-gold transition-colors duration-150"
              >
                <svg className="w-4 h-4 shrink-0 text-slate-300 group-hover:text-ua-gold transition-colors stroke-current fill-none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
                <span>web.ua.edu.ph</span>
              </a>
            </li>
            <li>
              <a 
                href="https://www.youtube.com/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="group flex items-center gap-2 hover:text-ua-gold transition-colors duration-150"
              >
                <svg className="w-4 h-4 shrink-0 text-slate-300 group-hover:text-ua-gold transition-colors fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                <span>University of the Assumption</span>
              </a>
            </li>
          </ul>
        </div>

        {/* Column 3: ABOUT */}
        <div className="space-y-3">
          <h4 className="text-xs font-black tracking-widest text-slate-205 text-slate-200 uppercase">About</h4>
          <p className="text-xs text-slate-300 leading-relaxed font-semibold">
            Dedicated to the holistic development of the person through instruction, research, and community extension services under the patronage of Our Lady of the Assumption.
          </p>
        </div>

        {/* Column 4: Developed By */}
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black tracking-widest text-slate-200 uppercase">Developed by:</h4>
              <img 
                src="/how-logo.png" 
                alt="HOW Logo" 
                className="h-5 object-contain bg-white/10 rounded px-1 py-0.5" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] font-bold text-slate-300 uppercase tracking-wide">
              {developers.map((dev) => (
                <div key={dev} className="hover:text-ua-gold transition-colors duration-100">
                  {dev}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-white/10">
            <a 
              href="https://ua-cit.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-block group"
            >
              <img 
                src="/cit-logo.png" 
                alt="CIT Logo" 
                className="w-[60px] h-[60px] object-contain rounded-full bg-white/5 p-1 group-hover:scale-105 group-hover:bg-white/15 transition-all duration-200" 
              />
            </a>
          </div>
        </div>

      </div>

      {/* Separator line & Copyright notice */}
      <div className="max-w-7xl mx-auto border-t border-white/10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] tracking-wider uppercase font-bold text-slate-300/80">
        <p className="text-center sm:text-left">
          &copy; {new Date().getFullYear()} University of the Assumption. All rights reserved.
        </p>
        <div>
          <button 
            type="button"
            onClick={() => setShowQualityModal(true)}
            className="hover:text-ua-gold transition-colors cursor-pointer uppercase tracking-wider font-extrabold text-[10px] outline-none"
          >
            Quality Policy
          </button>
        </div>
      </div>

      {/* Quality Policy Modal Overlay */}
      {showQualityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-slate-800">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[80vh] animate-fade-in">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-ua-blue text-white flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-base text-ua-gold uppercase tracking-wider">Quality Policy</h3>
                <p className="text-[10px] text-slate-200 mt-0.5 uppercase tracking-widest font-bold">University of the Assumption</p>
              </div>
              <button 
                onClick={() => setShowQualityModal(false)}
                className="text-white/70 hover:text-white font-bold text-sm bg-white/10 rounded-full w-8 h-8 flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed text-slate-700">
              <p className="font-extrabold text-sm text-slate-900 leading-relaxed">
                The University of the Assumption, an Archdiocesan Catholic educational institution, commits itself to the development of Catholic leaders through academic excellence, Christian formation and community service. Thus, we commit to…
              </p>
              
              <ul className="space-y-2.5 pl-5 list-disc font-semibold text-slate-655">
                <li>sustain a strong and visible commitment to Catholic tradition;</li>
                <li>deliver responsive and quality instruction;</li>
                <li>enhance and promote research-based practices for the upgrading of instruction and extension;</li>
                <li>create an impact in the immediate and larger community;</li>
                <li>effectively deliver student services towards a dynamic learning environment and manage resources for sustainable institutional growth;</li>
                <li>create and maintain a working environment in which people become fully involved in achieving our objectives;</li>
                <li>manage activities and related resources as a process or series of interconnected processes so that desired results are achieved more efficiently;</li>
                <li>pursue continual improvement across all aspects of our quality management system;</li>
                <li>make decisions relating to our quality management system following an analysis of relevant data and information;</li>
                <li>establish interdependent and mutually beneficial relationships with local and international institutions and other interested parties;</li>
                <li>continuously care for Mother Earth, our common home for the sustenance of life.</li>
              </ul>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t flex justify-end">
              <button 
                onClick={() => setShowQualityModal(false)}
                className="px-5 py-2.5 bg-ua-blue hover:bg-ua-blue-dark text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-md shadow-ua-blue/10 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
