import React from 'react';
import { Printer, X } from 'lucide-react';

export default function SanctionMemoModal({
  isOpen = true,
  onClose,
  block,
  job,
  department = 'Engineering',
}) {
  if (!isOpen) return null;

  // Real or derived operational data
  const blockId = block?.block_id || 'BLK-SIM-001';
  const trackId = block?.track_id || job?.track_id || 'PUNE-LNL-UP';
  const sectionId = block?.section_id || job?.section_id || 'PUNE-LNL';
  const locationKm = job?.location_km || 42.3;
  const startKm = Math.max(0, locationKm - 1.2).toFixed(2);
  const endKm = (locationKm + 1.5).toFixed(2);
  const durationHours = block?.duration_hours || job?.estimated_duration_hours || 3.5;

  const startTimeStr = block?.start_time
    ? new Date(block.start_time).toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }) + ' hrs'
    : '12.09.2026 / 01:15 hrs';

  const endTimeStr = block?.end_time
    ? new Date(block.end_time).toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }) + ' hrs'
    : '12.09.2026 / 04:45 hrs';

  const defectDesc =
    job?.defect_type ||
    block?.explanation?.split('for')?.[1]?.split('.')?.[0] ||
    'Turnout Renewal & Ballast Deep Screening (टर्नआउट नवीनीकरण एवं गिट्टी पैकिंग)';

  const primaryJobId = (block?.job_ids || (job ? [job.job_id] : ['ENG-1047']))[0] || 'ENG-1047';
  const memoNo = `CR/PA/OPTG/LB-2026/09/W1-${primaryJobId.replace(/[^0-9]/g, '') || '042'}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      {/* Outer Modal Container */}
      <div className="flex flex-col w-full max-w-[840px] max-h-[96vh] bg-[#F8FAFC] rounded shadow-2xl overflow-hidden border border-[#94A3B8] my-auto">
        
        {/* Action Top Bar (Screen Only - Hidden in Print) */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0A2540] text-white print:hidden border-b border-[#1E3A5F]">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#E11D48] animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Indian Railways Line Block Sanction Memo • फॉर्म टी/1518 (Form T/1518)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded bg-[#B91C1C] hover:bg-[#991B1B] px-3.5 py-1.5 text-xs font-bold text-white transition shadow-sm border border-red-400/40"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / Save PDF (A4)</span>
            </button>
            <button
              onClick={onClose}
              className="rounded p-1 text-slate-300 hover:text-white hover:bg-white/10 transition"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Paper Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-[#CBD5E1]">
          
          {/* THE OFFICIAL RAILWAY MEMO SHEET */}
          <div
            id="sanction-memo-printable"
            className="w-full bg-[#FFFDF9] border-2 border-[#800000] shadow-lg p-5 sm:p-8 font-serif text-[#111827] relative select-text"
            style={{ minHeight: '950px' }}
          >
            {/* Authentic Central Indian Railways Blue Logo Watermark in the Background */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.08] overflow-hidden select-none">
              <img
                src="/assets/mars/indian_railways_logo.png"
                alt="Indian Railways Seal Watermark"
                className="w-[340px] h-[340px] object-contain grayscale"
              />
            </div>

            {/* 1. TOP OFFICIAL RED HEADER BAR */}
            <div className="bg-[#8B0000] text-white px-3 py-2 -mx-5 -mt-5 sm:-mx-8 sm:-mt-8 border-b-2 border-[#5B0000]">
              <div className="flex items-center justify-between">
                {/* Left: National Emblem */}
                <div className="flex items-center gap-2.5">
                  <img
                    src="/emblem.png"
                    alt="Emblem of India"
                    className="h-12 w-auto object-contain brightness-0 invert"
                  />
                  <div className="text-left font-sans leading-tight">
                    <div className="text-[11px] font-extrabold tracking-wider">भारत सरकार</div>
                    <div className="text-[9px] font-bold tracking-wide uppercase opacity-90">GOVERNMENT OF INDIA</div>
                    <div className="text-[10px] font-semibold">रेल मंत्रालय</div>
                    <div className="text-[8px] tracking-wide uppercase opacity-90">MINISTRY OF RAILWAYS</div>
                  </div>
                </div>

                {/* Center: Division & Branch */}
                <div className="text-center font-sans">
                  <div className="text-sm font-black tracking-wider uppercase text-[#FEF08A]">
                    मध्य रेल • CENTRAL RAILWAY
                  </div>
                  <div className="text-[11px] font-extrabold tracking-wide uppercase text-white">
                    मंडल रेल प्रबंधक कार्यालय • PUNE DIVISION
                  </div>
                  <div className="text-[9px] font-semibold text-slate-200">
                    परिचालन विभाग (केंद्रीय नियंत्रण कक्ष) • OPERATING DEPARTMENT (CONTROL OFFICE)
                  </div>
                </div>

                {/* Right: Indian Railways Official Round Logo */}
                <div className="flex items-center gap-2">
                  <div className="text-right font-sans leading-tight hidden sm:block">
                    <div className="text-[10px] font-extrabold text-[#FEF08A]">भारतीय रेल</div>
                    <div className="text-[8px] uppercase tracking-wider text-slate-200">INDIAN RAILWAYS</div>
                    <div className="text-[9px] font-mono font-bold text-white">BDMS / G&SR 15.06</div>
                  </div>
                  <img
                    src="/assets/mars/indian_railways_logo.png"
                    alt="Indian Railways Logo"
                    className="h-12 w-12 object-contain rounded-full bg-white p-0.5 shadow-xs"
                  />
                </div>
              </div>
            </div>

            {/* 2. FORM TITLE BOX (BILINGUAL) */}
            <div className="mt-4 border-2 border-[#8B0000] bg-[#FFF8F0] p-2 text-center">
              <div className="font-sans text-xs font-black tracking-widest text-[#8B0000] uppercase">
                प्रपत्र संख्या: टी/1518 • FORM NO: T/1518
              </div>
              <h1 className="text-sm sm:text-base font-extrabold text-[#1E293B] uppercase tracking-tight">
                लाइन ब्लॉक एवं कार्य अनुमति स्वीकृति आदेश
              </h1>
              <h2 className="text-xs sm:text-sm font-bold text-[#8B0000] uppercase tracking-wide">
                LINE BLOCK SANCTION ORDER & PERMIT-TO-WORK (PTW)
              </h2>
              <p className="text-[9px] font-sans text-[#475569] mt-0.5">
                [सामान्य एवं सहायक नियम 15.06 तथा आई.आर.पी.डब्ल्यू.एम. 808 के अनुपालन में / In Compliance with G&SR Rule 15.06 & IRPWM Para 808]
              </p>
            </div>

            {/* 3. MEMO METADATA ROW */}
            <div className="mt-3 grid grid-cols-2 gap-2 border border-[#8B0000] bg-[#FAFAF9] p-2 font-sans text-[10px] leading-relaxed">
              <div>
                <span className="font-bold text-[#57534E]">मेमो सं. / MEMO NO:</span>{' '}
                <span className="font-mono font-black text-[#8B0000]">{memoNo}</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-[#57534E]">दिनांक व समय / DATE & TIME:</span>{' '}
                <span className="font-mono font-bold text-[#111827]">11-09-2026 • 22:30 बजे (hrs)</span>
              </div>
              <div>
                <span className="font-bold text-[#57534E]">प्रेषक / FROM:</span>{' '}
                <span className="font-semibold text-[#111827]">
                  वरिष्ठ मंडल परिचालन प्रबंधक (Sr. DOM / Co-ord), पुणे
                </span>
              </div>
              <div className="text-right">
                <span className="font-bold text-[#57534E]">प्रणाली संदर्भ / REF:</span>{' '}
                <span className="font-mono font-bold text-[#1E3A5F]">CRIS-BDMS / MARS-SANCTION</span>
              </div>
            </div>

            {/* 4. ADDRESS BLOCK */}
            <div className="mt-2 border border-[#CBD5E1] bg-white p-2 font-sans text-[10px]">
              <div className="font-bold text-[#8B0000] uppercase text-[9px] border-b border-[#E2E8F0] pb-0.5 mb-1">
                सेवा में / TO:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[#1F2937]">
                <div>
                  <strong>1. स्टेशन प्रबंधक (Station Master):</strong> देहू रोड (DEHR) एवं बेगडेवाडी (BGWI) स्टेशन
                </div>
                <div>
                  <strong>2. वरिष्ठ खंड अभियंता (Sr. Section Engineer):</strong> {department} (P-Way / S&T / TRD), पुणे मंडल
                </div>
              </div>
            </div>

            {/* 5. MAIN TABULAR SCHEDULE SPECIFICATIONS */}
            <div className="mt-3">
              <div className="bg-[#8B0000] text-white px-2.5 py-1 text-[10px] font-sans font-extrabold tracking-wider uppercase flex justify-between">
                <span>स्वीकृत ब्लॉक विवरण • SANCTIONED BLOCK SPECIFICATIONS</span>
                <span className="font-mono text-[9px]">BLOCK REF: {blockId}</span>
              </div>

              <table className="w-full border-collapse border border-[#8B0000] font-sans text-[10px]">
                <tbody>
                  {/* Row 1: Section & Track */}
                  <tr className="border-b border-[#CBD5E1]">
                    <td className="w-[30%] bg-[#F5F5F4] p-2 font-bold text-[#44403C] border-r border-[#CBD5E1]">
                      ब्लॉक खंड / Block Section
                    </td>
                    <td className="w-[70%] p-2 font-bold text-[#0F172A]">
                      {sectionId} • देहू रोड (DEHR) — बेगडेवाडी (BGWI) [पुणे – लोनावला मुख्य मार्ग]
                    </td>
                  </tr>

                  {/* Row 2: Track & Line */}
                  <tr className="border-b border-[#CBD5E1]">
                    <td className="bg-[#F5F5F4] p-2 font-bold text-[#44403C] border-r border-[#CBD5E1]">
                      लाइन / Track Line
                    </td>
                    <td className="p-2 font-mono font-extrabold text-[#8B0000]">
                      {trackId} (अप मुख्य लाइन / UP Main Line)
                    </td>
                  </tr>

                  {/* Row 3: Km Limits */}
                  <tr className="border-b border-[#CBD5E1]">
                    <td className="bg-[#F5F5F4] p-2 font-bold text-[#44403C] border-r border-[#CBD5E1]">
                      स्थान कि.मी. / Kilometre Limits
                    </td>
                    <td className="p-2 font-bold text-[#0F172A]">
                      कि.मी. {startKm} से कि.मी. {endKm} तक (Km {startKm} to Km {endKm})
                    </td>
                  </tr>

                  {/* Row 4: Sanctioned Window */}
                  <tr className="border-b border-[#CBD5E1] bg-[#FFFBEB]">
                    <td className="bg-[#FEF3C7] p-2 font-bold text-[#92400E] border-r border-[#CBD5E1]">
                      स्वीकृत समय अवधि / Sanctioned Window
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono">
                        <div>
                          <span className="text-[9px] font-sans text-[#78350F]">प्रारंभ / FROM:</span>{' '}
                          <strong className="text-[#16A34A]">{startTimeStr}</strong>
                        </div>
                        <div>
                          <span className="text-[9px] font-sans text-[#78350F]">समाप्ति / UPTO:</span>{' '}
                          <strong className="text-[#DC2626]">{endTimeStr}</strong>
                        </div>
                        <div className="border-l border-[#D97706] pl-2 font-sans text-[#92400E] font-bold">
                          कुल अवधि: {durationHours} घंटे (Gross Duration: {durationHours} hrs)
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Row 5: Work Nature */}
                  <tr className="border-b border-[#CBD5E1]">
                    <td className="bg-[#F5F5F4] p-2 font-bold text-[#44403C] border-r border-[#CBD5E1]">
                      कार्य का स्वरूप / Nature of Work
                    </td>
                    <td className="p-2 font-semibold text-[#0F172A]">
                      {defectDesc}
                    </td>
                  </tr>

                  {/* Row 6: Machines Authorized */}
                  <tr className="border-b border-[#CBD5E1]">
                    <td className="bg-[#F5F5F4] p-2 font-bold text-[#44403C] border-r border-[#CBD5E1]">
                      प्राधिकृत मशीनें / Track Machines
                    </td>
                    <td className="p-2 font-semibold text-[#0F172A]">
                      सीएसएम 09-32 टैंपिंग मशीन (CSM-PUNE-804) • कार्य स्थल तक गति: 40 किमी/घंटा
                    </td>
                  </tr>

                  {/* Row 7: Power Block */}
                  <tr className="border-b border-[#CBD5E1]">
                    <td className="bg-[#F5F5F4] p-2 font-bold text-[#44403C] border-r border-[#CBD5E1]">
                      25kV ओ.एच.ई. पावर ब्लॉक / OHE Isolation
                    </td>
                    <td className="p-2 font-bold text-[#16A34A]">
                      स्वीकृत (GRANTED) • टी.पी.सी. परमिट सं.: TPC/PA/25KV/9942 • खंभा 42/10 से 44/25
                    </td>
                  </tr>

                  {/* Row 8: TSR Caution Order */}
                  <tr>
                    <td className="bg-[#F5F5F4] p-2 font-bold text-[#44403C] border-r border-[#CBD5E1]">
                      कॉशन ऑर्डर / Speed Restriction (TSR)
                    </td>
                    <td className="p-2 font-bold text-[#D97706]">
                      30 किमी/घंटा का कॉशन ऑर्डर (CAUTION ORDER 30 KM/H on UP Line after line clearance)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 6. COA TIMETABLE SAFETY CLEARANCE */}
            <div className="mt-3 border border-[#8B0000] p-2.5 font-sans bg-[#F8FAFC]">
              <div className="font-bold text-[#8B0000] text-[10px] uppercase border-b border-[#CBD5E1] pb-1 flex justify-between items-center">
                <span>गाड़ी संचालन सुरक्षा एवं हेडवे प्रमाणीकरण • TRAIN CLEARANCE ASSURANCE</span>
                <span className="text-[8px] bg-[#0A2540] text-white px-1.5 py-0.5 rounded font-mono">
                  COA TIMETABLE VERIFIED
                </span>
              </div>

              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                <div className="border border-[#E2E8F0] bg-white p-2 rounded-xs">
                  <span className="font-bold text-[#475569]">पिछली प्रस्थान गाड़ी / Last Preceding Train:</span>
                  <div className="mt-0.5 font-bold text-[#0F172A]">
                    गाड़ी सं. 12124 (डेक्कन क्वीन एक्सप्रेस) — 01:03 बजे बेगडेवाडी पार।
                  </div>
                  <div className="text-[9px] text-[#16A34A] font-semibold">✓ 15-मिनट का क्लियरेंस मार्जिन सुरक्षित।</div>
                </div>

                <div className="border border-[#E2E8F0] bg-white p-2 rounded-xs">
                  <span className="font-bold text-[#475569]">आगामी रोकी गई गाड़ी / Following Regulated Train:</span>
                  <div className="mt-0.5 font-bold text-[#0F172A]">
                    गाड़ी सं. 11008 (डेक्कन एक्सप्रेस) — लोनावला लूप पर 05:05 बजे तक नियमन।
                  </div>
                  <div className="text-[9px] text-[#2563EB] font-semibold">✓ सुरक्षित सिग्नल नियंत्रण स्थापित।</div>
                </div>
              </div>

              <div className="mt-2 text-[9px] text-[#334155] leading-tight">
                <strong>साइट सुरक्षा नियम:</strong> जी एंड एसआर 15.09 के अनुसार 600 मीटर एवं 1200 मीटर पर लाल बैनर झंडे तथा 3 डेटोनेटर पटाखे लगाना अनिवार्य है।
              </div>
            </div>

            {/* 7. PRIVATE NUMBERS (PN) EXCHANGE BOX */}
            <div className="mt-3 grid grid-cols-2 gap-3 border border-[#8B0000] bg-[#FFF8F0] p-2 font-mono text-[10px]">
              <div>
                <span className="font-sans font-bold text-[#8B0000]">नियंत्रक पी.एन. / CONTROLLER PN:</span>{' '}
                <strong className="text-base font-black text-[#8B0000]">PN - 42</strong>
                <p className="font-sans text-[8px] text-[#78350F]">(जारीकर्ता: अनुभाग नियंत्रक, पुणे नियंत्रण)</p>
              </div>
              <div className="text-right">
                <span className="font-sans font-bold text-[#8B0000]">स्टेशन मास्टर पी.एन. / SM PN:</span>{' '}
                <strong className="text-base font-black text-[#0A2540]">PN - 18</strong>
                <p className="font-sans text-[8px] text-[#78350F]">(प्राप्तकर्ता: स्टेशन प्रबंधक, देहू रोड)</p>
              </div>
            </div>

            {/* 8. STATUTORY SIGNATURES & OFFICIAL SEALS */}
            <div className="mt-8 pt-4 border-t-2 border-[#8B0000] font-sans">
              <div className="grid grid-cols-3 gap-4 text-center text-[10px]">
                {/* Sign 1: SSE */}
                <div>
                  <div className="h-9 border-b border-dashed border-[#64748B]" />
                  <div className="mt-1.5 font-extrabold text-[#0F172A]">हस्ताक्षर प्रभारी अभियंता</div>
                  <div className="text-[9px] font-bold text-[#475569]">SENIOR SECTION ENGINEER</div>
                  <div className="text-[8px] text-[#64748B]">({department} / P-Way / S&T)</div>
                  <div className="font-mono text-[8px] text-[#94A3B8]">ID: SSE/PWAY/PUNE/2026</div>
                </div>

                {/* Sign 2: Station Master */}
                <div>
                  <div className="h-9 border-b border-dashed border-[#64748B]" />
                  <div className="mt-1.5 font-extrabold text-[#0F172A]">हस्ताक्षर स्टेशन प्रबंधक</div>
                  <div className="text-[9px] font-bold text-[#475569]">STATION MASTER</div>
                  <div className="text-[8px] text-[#64748B]">(Dehu Road / Station Seal)</div>
                  <div className="font-mono text-[8px] text-[#94A3B8]">PF: SM-DEHR-1092</div>
                </div>

                {/* Sign 3: Section Controller */}
                <div>
                  <div className="h-9 border-b border-dashed border-[#64748B]" />
                  <div className="mt-1.5 font-extrabold text-[#0F172A]">हस्ताक्षर अनुभाग नियंत्रक</div>
                  <div className="text-[9px] font-bold text-[#475569]">SECTION CONTROLLER</div>
                  <div className="text-[8px] text-[#64748B]">(Divisional Control Office, Pune)</div>
                  <div className="font-mono text-[8px] text-[#94A3B8]">DESK: CHIEF-COACHING-PUNE</div>
                </div>
              </div>

              {/* Red/Green Official Government Stamp */}
              <div className="mt-5 flex items-center justify-between border-2 border-[#15803D] bg-[#F0FDF4] px-3 py-1.5 text-[9px] text-[#166534]">
                <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
                  <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
                  <span>प्रमाणित एवं अधिकृत • SANCTIONED & SECURED VIA CRIS-BDMS & MARS</span>
                </div>
                <div className="font-mono font-bold">
                  SURAKSHA PROTOCOL AUDITED • 2026-09-11
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
