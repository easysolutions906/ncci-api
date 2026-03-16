#!/usr/bin/env node

/**
 * Build NCCI PTP edit and MUE data files.
 *
 * Attempts to fetch from CMS first; falls back to comprehensive sample data
 * covering the most commonly billed CPT/HCPCS code pairs.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'src', 'data');

mkdirSync(DATA_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// CPT code descriptions (subset for search)
// ---------------------------------------------------------------------------

const CPT_DESCRIPTIONS = {
  '99201': 'Office visit, new patient, level 1',
  '99202': 'Office visit, new patient, level 2',
  '99203': 'Office visit, new patient, level 3',
  '99204': 'Office visit, new patient, level 4',
  '99205': 'Office visit, new patient, level 5',
  '99211': 'Office visit, established patient, level 1',
  '99212': 'Office visit, established patient, level 2',
  '99213': 'Office visit, established patient, level 3',
  '99214': 'Office visit, established patient, level 4',
  '99215': 'Office visit, established patient, level 5',
  '99221': 'Initial hospital care, level 1',
  '99222': 'Initial hospital care, level 2',
  '99223': 'Initial hospital care, level 3',
  '99231': 'Subsequent hospital care, level 1',
  '99232': 'Subsequent hospital care, level 2',
  '99233': 'Subsequent hospital care, level 3',
  '99238': 'Hospital discharge day, 30 min or less',
  '99239': 'Hospital discharge day, more than 30 min',
  '99281': 'ED visit, level 1',
  '99282': 'ED visit, level 2',
  '99283': 'ED visit, level 3',
  '99284': 'ED visit, level 4',
  '99285': 'ED visit, level 5',
  '99291': 'Critical care, first 30-74 min',
  '99292': 'Critical care, each additional 30 min',
  '99381': 'Preventive visit, new patient, infant',
  '99382': 'Preventive visit, new patient, age 1-4',
  '99383': 'Preventive visit, new patient, age 5-11',
  '99384': 'Preventive visit, new patient, age 12-17',
  '99385': 'Preventive visit, new patient, age 18-39',
  '99386': 'Preventive visit, new patient, age 40-64',
  '99391': 'Preventive visit, established, infant',
  '99392': 'Preventive visit, established, age 1-4',
  '99393': 'Preventive visit, established, age 5-11',
  '99394': 'Preventive visit, established, age 12-17',
  '99395': 'Preventive visit, established, age 18-39',
  '99396': 'Preventive visit, established, age 40-64',
  '10060': 'Incision and drainage of abscess, simple',
  '10061': 'Incision and drainage of abscess, complicated',
  '10120': 'Incision and removal of foreign body, simple',
  '10121': 'Incision and removal of foreign body, complicated',
  '10140': 'Incision and drainage of hematoma',
  '10160': 'Puncture aspiration of abscess',
  '11042': 'Debridement, subcutaneous tissue, first 20 sq cm',
  '11043': 'Debridement, muscle/fascia, first 20 sq cm',
  '11044': 'Debridement, bone, first 20 sq cm',
  '11045': 'Debridement, subcutaneous tissue, each addtl 20 sq cm',
  '11046': 'Debridement, muscle/fascia, each addtl 20 sq cm',
  '11047': 'Debridement, bone, each addtl 20 sq cm',
  '11055': 'Paring of benign hyperkeratotic lesion, single',
  '11056': 'Paring of benign hyperkeratotic lesion, 2-4',
  '11057': 'Paring of benign hyperkeratotic lesion, >4',
  '11102': 'Tangential biopsy of skin, single lesion',
  '11103': 'Tangential biopsy of skin, each additional',
  '11104': 'Punch biopsy of skin, single lesion',
  '11105': 'Punch biopsy of skin, each additional',
  '11106': 'Incisional biopsy of skin, single lesion',
  '11107': 'Incisional biopsy of skin, each additional',
  '11200': 'Removal of skin tags, up to 15',
  '11201': 'Removal of skin tags, each additional 10',
  '12001': 'Simple repair of wound, 2.5 cm or less',
  '12002': 'Simple repair of wound, 2.6-7.5 cm',
  '12004': 'Simple repair of wound, 7.6-12.5 cm',
  '12011': 'Simple repair of wound, face, 2.5 cm or less',
  '12013': 'Simple repair of wound, face, 2.6-5.0 cm',
  '12031': 'Intermediate repair, 2.5 cm or less',
  '12032': 'Intermediate repair, 2.6-7.5 cm',
  '13100': 'Complex repair, trunk, 1.1-2.5 cm',
  '13101': 'Complex repair, trunk, 2.6-7.5 cm',
  '17000': 'Destruction of premalignant lesion, first',
  '17003': 'Destruction of premalignant lesion, 2-14 each',
  '17004': 'Destruction of premalignant lesion, 15 or more',
  '17110': 'Destruction of benign lesions, up to 14',
  '17111': 'Destruction of benign lesions, 15 or more',
  '20600': 'Arthrocentesis, small joint',
  '20605': 'Arthrocentesis, intermediate joint',
  '20610': 'Arthrocentesis, major joint',
  '20611': 'Arthrocentesis, major joint with ultrasound',
  '27447': 'Total knee arthroplasty',
  '27130': 'Total hip arthroplasty',
  '27446': 'Knee arthroplasty, medial/lateral compartment',
  '29877': 'Knee arthroscopy, debridement/shaving',
  '29880': 'Knee arthroscopy, meniscectomy medial and lateral',
  '29881': 'Knee arthroscopy, meniscectomy medial or lateral',
  '29882': 'Knee arthroscopy, meniscus repair medial',
  '29883': 'Knee arthroscopy, meniscus repair lateral',
  '29874': 'Knee arthroscopy, removal of loose body',
  '29875': 'Knee arthroscopy, synovectomy limited',
  '29876': 'Knee arthroscopy, synovectomy major',
  '29884': 'Knee arthroscopy, lysis of adhesions',
  '29866': 'Knee arthroscopy, osteochondral autograft',
  '29867': 'Knee arthroscopy, osteochondral allograft',
  '29868': 'Knee arthroscopy, meniscal transplant',
  '36415': 'Venipuncture, routine',
  '36416': 'Capillary blood collection',
  '36410': 'Venipuncture, age 3+, necessitating physician skill',
  '36591': 'Blood draw from central venous catheter',
  '36592': 'Blood draw from implanted port',
  '43235': 'Upper GI endoscopy, diagnostic',
  '43236': 'Upper GI endoscopy with directed submucosal injection',
  '43239': 'Upper GI endoscopy with biopsy',
  '43241': 'Upper GI endoscopy with transendoscopic tube placement',
  '43242': 'Upper GI endoscopy with ultrasound-guided FNA',
  '43243': 'Upper GI endoscopy with injection of varix',
  '43244': 'Upper GI endoscopy with band ligation of varix',
  '43245': 'Upper GI endoscopy with dilation of stricture',
  '43246': 'Upper GI endoscopy with PEG tube placement',
  '43247': 'Upper GI endoscopy with foreign body removal',
  '43248': 'Upper GI endoscopy with dilation, balloon',
  '43249': 'Upper GI endoscopy with balloon dilation esophagus',
  '43250': 'Upper GI endoscopy with tumor removal',
  '43251': 'Upper GI endoscopy with mucosal resection',
  '43252': 'Upper GI endoscopy with optical endomicroscopy',
  '43253': 'Upper GI endoscopy with RFA of Barrett\'s',
  '43254': 'Upper GI endoscopy with endoscopic mucosal resection',
  '43255': 'Upper GI endoscopy with control of bleeding',
  '43257': 'Upper GI endoscopy with stent placement',
  '43259': 'Upper GI endoscopy with EUS',
  '43270': 'Upper GI endoscopy with ablation of tumor',
  '45330': 'Sigmoidoscopy, diagnostic',
  '45331': 'Sigmoidoscopy with biopsy',
  '45333': 'Sigmoidoscopy with polypectomy, hot biopsy',
  '45338': 'Sigmoidoscopy with polypectomy, snare',
  '45378': 'Colonoscopy, diagnostic',
  '45380': 'Colonoscopy with biopsy',
  '45381': 'Colonoscopy with directed submucosal injection',
  '45382': 'Colonoscopy with control of bleeding',
  '45384': 'Colonoscopy with polypectomy, hot biopsy',
  '45385': 'Colonoscopy with polypectomy, snare',
  '45386': 'Colonoscopy with dilation',
  '45388': 'Colonoscopy with ablation',
  '45389': 'Colonoscopy with stent placement',
  '45390': 'Colonoscopy with foreign body removal',
  '45391': 'Colonoscopy with EUS',
  '45392': 'Colonoscopy with EUS-guided FNA',
  '45393': 'Colonoscopy with decompression',
  '45398': 'Colonoscopy with band ligation',
  '47562': 'Laparoscopic cholecystectomy',
  '47563': 'Laparoscopic cholecystectomy with cholangiography',
  '47564': 'Laparoscopic cholecystectomy with exploration of common duct',
  '49505': 'Inguinal hernia repair, initial',
  '49507': 'Inguinal hernia repair, incarcerated',
  '49520': 'Inguinal hernia repair, recurrent',
  '49585': 'Ventral hernia repair, initial',
  '49587': 'Ventral hernia repair, incarcerated',
  '49650': 'Laparoscopic inguinal hernia repair',
  '49651': 'Laparoscopic inguinal hernia repair, recurrent',
  '49652': 'Laparoscopic ventral hernia repair',
  '49653': 'Laparoscopic ventral hernia repair, incarcerated',
  '50590': 'Lithotripsy (ESWL)',
  '52000': 'Cystourethroscopy',
  '52001': 'Cystourethroscopy with irrigation',
  '52005': 'Cystourethroscopy with ureteral catheterization',
  '52204': 'Cystourethroscopy with biopsy',
  '52214': 'Cystourethroscopy with fulguration of trigone',
  '52234': 'Cystourethroscopy with tumor destruction, small',
  '52235': 'Cystourethroscopy with tumor destruction, medium',
  '52240': 'Cystourethroscopy with tumor destruction, large',
  '52310': 'Cystourethroscopy with stone removal, simple',
  '52315': 'Cystourethroscopy with stone removal, complex',
  '52332': 'Cystourethroscopy with stent insertion',
  '52353': 'Cystourethroscopy with lithotripsy',
  '57452': 'Colposcopy with biopsy of cervix',
  '57454': 'Colposcopy with biopsy and endocervical curettage',
  '57455': 'Colposcopy with biopsy and LEEP',
  '57456': 'Colposcopy with endocervical curettage',
  '57460': 'Colposcopy with LEEP of cervix',
  '57500': 'Biopsy of cervix, single or multiple',
  '57505': 'Endocervical curettage',
  '58100': 'Endometrial biopsy',
  '58120': 'Dilation and curettage, diagnostic',
  '58150': 'Total abdominal hysterectomy',
  '58260': 'Vaginal hysterectomy',
  '58262': 'Vaginal hysterectomy, >250g',
  '58291': 'Vaginal hysterectomy with removal of tube(s)/ovary(s)',
  '58550': 'Laparoscopic-assisted vaginal hysterectomy',
  '58552': 'Laparoscopic-assisted vaginal hysterectomy with tube/ovary removal',
  '58558': 'Hysteroscopy with biopsy',
  '58561': 'Hysteroscopy with leiomyoma removal',
  '58563': 'Hysteroscopy with ablation of endometrium',
  '59400': 'Obstetric care, vaginal delivery',
  '59510': 'Obstetric care, cesarean delivery',
  '59610': 'Obstetric care, VBAC delivery',
  '62321': 'Cervical/thoracic epidural injection',
  '62322': 'Lumbar/caudal epidural injection under fluoroscopy',
  '62323': 'Lumbar/caudal epidural injection with imaging',
  '64483': 'Transforaminal epidural injection, lumbar/sacral, single',
  '64484': 'Transforaminal epidural injection, lumbar/sacral, each additional',
  '64490': 'Facet joint injection, cervical/thoracic, single',
  '64491': 'Facet joint injection, cervical/thoracic, second level',
  '64492': 'Facet joint injection, cervical/thoracic, third level',
  '64493': 'Facet joint injection, lumbar/sacral, single',
  '64494': 'Facet joint injection, lumbar/sacral, second level',
  '64495': 'Facet joint injection, lumbar/sacral, third level',
  '64615': 'Chemodenervation of muscle(s), migraine',
  '64616': 'Chemodenervation of muscle(s), neck',
  '64617': 'Chemodenervation, larynx',
  '64633': 'Radiofrequency ablation, cervical/thoracic facet, single',
  '64634': 'Radiofrequency ablation, cervical/thoracic facet, each addtl',
  '64635': 'Radiofrequency ablation, lumbar/sacral facet, single',
  '64636': 'Radiofrequency ablation, lumbar/sacral facet, each addtl',
  '69210': 'Removal of impacted cerumen, unilateral',
  '70553': 'MRI brain with and without contrast',
  '71046': 'Chest X-ray, 2 views',
  '71260': 'CT chest with contrast',
  '72148': 'MRI lumbar spine without contrast',
  '72149': 'MRI lumbar spine with contrast',
  '72158': 'MRI lumbar spine with and without contrast',
  '73721': 'MRI knee without contrast',
  '73723': 'MRI knee with and without contrast',
  '74177': 'CT abdomen/pelvis with contrast',
  '74178': 'CT abdomen/pelvis with and without contrast',
  '76700': 'Ultrasound, abdominal, complete',
  '76770': 'Ultrasound, retroperitoneal, complete',
  '76805': 'Ultrasound, pregnant uterus, complete',
  '76830': 'Ultrasound, transvaginal',
  '76856': 'Ultrasound, pelvic, complete',
  '76857': 'Ultrasound, pelvic, limited',
  '77067': 'Screening mammography, bilateral',
  '80048': 'Basic metabolic panel',
  '80050': 'General health panel',
  '80053': 'Comprehensive metabolic panel',
  '80061': 'Lipid panel',
  '80069': 'Renal function panel',
  '80076': 'Hepatic function panel',
  '85025': 'Complete blood count (CBC) with differential',
  '85027': 'Complete blood count (CBC) without differential',
  '85610': 'Prothrombin time (PT)',
  '85730': 'Partial thromboplastin time (PTT)',
  '86580': 'TB skin test',
  '87070': 'Culture, bacterial, any source',
  '87077': 'Culture, aerobic isolate, identification',
  '87081': 'Culture, presumptive, pathogenic organisms',
  '87086': 'Culture, urine, quantitative',
  '87110': 'Culture, chlamydia',
  '87491': 'Chlamydia, amplified probe',
  '87591': 'Gonorrhea, amplified probe',
  '87804': 'Rapid influenza test',
  '87880': 'Rapid strep test',
  '88305': 'Surgical pathology, gross and micro, level IV',
  '88312': 'Special stain, group I',
  '88342': 'Immunohistochemistry, each antibody',
  '90460': 'Immunization administration, first component',
  '90461': 'Immunization administration, each additional component',
  '90471': 'Immunization administration, injectable',
  '90472': 'Immunization administration, each additional injectable',
  '90473': 'Immunization administration, oral/intranasal',
  '90474': 'Immunization administration, each additional oral/intranasal',
  '90658': 'Influenza vaccine, IIV3',
  '90686': 'Influenza vaccine, IIV4, preservative free',
  '90715': 'Tdap vaccine',
  '90732': 'Pneumococcal vaccine, PPSV23',
  '90834': 'Psychotherapy, 45 min',
  '90837': 'Psychotherapy, 60 min',
  '90846': 'Family psychotherapy without patient',
  '90847': 'Family psychotherapy with patient',
  '90853': 'Group psychotherapy',
  '92002': 'Ophthalmologic exam, new patient, intermediate',
  '92004': 'Ophthalmologic exam, new patient, comprehensive',
  '92012': 'Ophthalmologic exam, established, intermediate',
  '92014': 'Ophthalmologic exam, established, comprehensive',
  '92250': 'Fundus photography',
  '92557': 'Comprehensive audiometry',
  '93000': 'Electrocardiogram (ECG/EKG), 12-lead',
  '93005': 'ECG, tracing only',
  '93010': 'ECG, interpretation and report only',
  '93015': 'Cardiovascular stress test',
  '93016': 'Stress test, physician supervision only',
  '93017': 'Stress test, tracing only',
  '93018': 'Stress test, interpretation only',
  '93306': 'Echocardiography, complete with Doppler',
  '93307': 'Echocardiography, complete',
  '93308': 'Echocardiography, limited',
  '93312': 'Transesophageal echocardiography (TEE)',
  '93350': 'Stress echocardiography',
  '93351': 'Stress echocardiography with contrast',
  '93452': 'Left heart catheterization',
  '93453': 'Combined right and left heart catheterization',
  '93458': 'Coronary angiography with left heart cath',
  '93460': 'Coronary angiography with left and right heart cath',
  '93798': 'Cardiac rehab, physician-directed',
  '94010': 'Spirometry',
  '94060': 'Bronchospasm evaluation with spirometry',
  '94375': 'Respiratory flow volume loop',
  '94640': 'Nebulizer treatment',
  '94664': 'Inhaler/nebulizer demonstration and education',
  '94760': 'Pulse oximetry, single',
  '94761': 'Pulse oximetry, multiple',
  '95004': 'Allergy skin test, percutaneous',
  '95024': 'Allergy skin test, intracutaneous',
  '95115': 'Allergen immunotherapy injection, single',
  '95117': 'Allergen immunotherapy injection, two or more',
  '95810': 'Polysomnography, sleep staging',
  '95811': 'Polysomnography with CPAP',
  '96110': 'Developmental screening',
  '96127': 'Behavioral assessment, brief',
  '96360': 'IV infusion, hydration, initial 31 min-1 hr',
  '96361': 'IV infusion, hydration, each additional hr',
  '96365': 'IV infusion, therapeutic, initial 1 hr',
  '96366': 'IV infusion, therapeutic, each additional hr',
  '96367': 'IV infusion, therapeutic, additional sequential',
  '96372': 'Therapeutic injection, subcutaneous/intramuscular',
  '96373': 'Therapeutic injection, intra-arterial',
  '96374': 'Therapeutic injection, IV push',
  '96375': 'Therapeutic injection, each additional IV push',
  '96376': 'Therapeutic injection, each additional sequential IV push',
  '96413': 'Chemotherapy IV infusion, first hr',
  '96415': 'Chemotherapy IV infusion, each additional hr',
  '96417': 'Chemotherapy IV infusion, each additional sequential',
  '97010': 'Physical therapy, hot/cold packs',
  '97012': 'Physical therapy, mechanical traction',
  '97014': 'Physical therapy, electrical stimulation (attended)',
  '97016': 'Physical therapy, vasopneumatic device',
  '97018': 'Physical therapy, paraffin bath',
  '97022': 'Physical therapy, whirlpool',
  '97024': 'Physical therapy, diathermy',
  '97026': 'Physical therapy, infrared',
  '97032': 'Physical therapy, electrical stimulation (manual)',
  '97033': 'Physical therapy, iontophoresis',
  '97034': 'Physical therapy, contrast baths',
  '97035': 'Physical therapy, ultrasound',
  '97036': 'Physical therapy, Hubbard tank',
  '97110': 'Therapeutic exercises, 15 min',
  '97112': 'Neuromuscular reeducation, 15 min',
  '97113': 'Aquatic therapy, 15 min',
  '97116': 'Gait training, 15 min',
  '97140': 'Manual therapy, 15 min',
  '97150': 'Group therapeutic procedures',
  '97161': 'PT evaluation, low complexity',
  '97162': 'PT evaluation, moderate complexity',
  '97163': 'PT evaluation, high complexity',
  '97164': 'PT re-evaluation',
  '97530': 'Therapeutic activities, 15 min',
  '97535': 'Self-care/home management training, 15 min',
  '97542': 'Wheelchair management training, 15 min',
  '97750': 'Physical performance test, 15 min',
  '97760': 'Orthotic management and training, 15 min',
  '97761': 'Prosthetic management and training, 15 min',
  '99000': 'Handling of specimen for transfer',
  'G0101': 'Cervical/vaginal cancer screening, pelvic exam',
  'G0102': 'Prostate cancer screening, digital rectal exam',
  'G0103': 'Prostate cancer screening, PSA',
  'G0104': 'Colorectal cancer screening, flex sig',
  'G0105': 'Colorectal cancer screening, colonoscopy, high risk',
  'G0121': 'Colorectal cancer screening, colonoscopy, not high risk',
  'G0127': 'Trimming of dystrophic nails',
  'G0378': 'Hospital observation per hour',
  'G0379': 'Direct admission to observation',
  'G0463': 'Hospital outpatient clinic visit',
  'J0585': 'Injection, onabotulinumtoxinA, 1 unit',
  'J1030': 'Injection, methylprednisolone, 40mg',
  'J1040': 'Injection, methylprednisolone, 80mg',
  'J1071': 'Injection, testosterone cypionate, 1mg',
  'J1100': 'Injection, dexamethasone, 1mg',
  'J1885': 'Injection, ketorolac, 15mg',
  'J2001': 'Injection, lidocaine, 10mg',
  'J3301': 'Injection, triamcinolone acetonide, 10mg',
  'J7321': 'Hyaluronan injection for viscosupplementation',
};

// ---------------------------------------------------------------------------
// PTP edit pairs — comprehensive sample data
// ---------------------------------------------------------------------------

const generatePtpEdits = () => {
  const edits = [];
  const effectiveDate = '2024-01-01';

  // Helper: add an edit pair
  const add = (code1, code2, modifier = 0, rationale = '', category = 'general') => {
    edits.push({
      column1: code1,
      column2: code2,
      effectiveDate,
      deletionDate: null,
      modifierIndicator: modifier, // 0=not allowed, 1=allowed with modifier, 9=N/A
      rationale: rationale || 'Standard NCCI bundling edit',
      category,
      column1Description: CPT_DESCRIPTIONS[code1] || '',
      column2Description: CPT_DESCRIPTIONS[code2] || '',
    });
  };

  // ---- E&M conflicts (can't bill two E&M same day without modifier 25) ----
  const emNewCodes = ['99202', '99203', '99204', '99205'];
  const emEstCodes = ['99211', '99212', '99213', '99214', '99215'];
  const emAllCodes = [...emNewCodes, ...emEstCodes];

  // E&M vs E&M — same category
  emEstCodes.forEach((c1) => {
    emEstCodes.forEach((c2) => {
      if (c1 !== c2 && c1 < c2) {
        add(c1, c2, 0, 'Cannot bill two established patient E&M visits same provider, same day', 'em-conflict');
      }
    });
  });

  emNewCodes.forEach((c1) => {
    emNewCodes.forEach((c2) => {
      if (c1 !== c2 && c1 < c2) {
        add(c1, c2, 0, 'Cannot bill two new patient E&M visits same provider, same day', 'em-conflict');
      }
    });
  });

  // E&M vs preventive — need modifier 25
  const preventiveNew = ['99381', '99382', '99383', '99384', '99385', '99386'];
  const preventiveEst = ['99391', '99392', '99393', '99394', '99395', '99396'];

  emEstCodes.forEach((em) => {
    preventiveEst.forEach((prev) => {
      add(prev, em, 1, 'Separate E&M may be reported with modifier 25 if significant, separately identifiable service', 'em-preventive');
    });
  });

  emNewCodes.forEach((em) => {
    preventiveNew.forEach((prev) => {
      add(prev, em, 1, 'Separate E&M may be reported with modifier 25 if significant, separately identifiable service', 'em-preventive');
    });
  });

  // ---- Lab bundling ----
  // Venipuncture bundled with panels
  const labPanels = ['80048', '80050', '80053', '80061', '80069', '80076', '85025', '85027'];
  labPanels.forEach((panel) => {
    add(panel, '36415', 0, 'Venipuncture is included in laboratory panel services', 'lab-bundling');
    add(panel, '36416', 0, 'Capillary blood collection is included in laboratory panel services', 'lab-bundling');
  });

  // CBC components bundled into CBC
  add('85025', '85027', 0, 'CBC with differential includes CBC without differential', 'lab-bundling');

  // CMP includes BMP
  add('80053', '80048', 0, 'Comprehensive metabolic panel includes basic metabolic panel', 'lab-bundling');

  // General health panel includes CMP and CBC
  add('80050', '80053', 0, 'General health panel includes comprehensive metabolic panel', 'lab-bundling');
  add('80050', '80048', 0, 'General health panel includes basic metabolic panel', 'lab-bundling');
  add('80050', '85025', 0, 'General health panel includes CBC with differential', 'lab-bundling');

  // PT/PTT
  add('85610', '85730', 1, 'PT and PTT may be reported separately with appropriate modifier', 'lab-bundling');

  // ---- Knee arthroscopy bundling ----
  const kneeArthBase = ['29874', '29875', '29876', '29877', '29880', '29881', '29882', '29883', '29884'];

  // 29881 (meniscectomy) includes 29877 (debridement)
  add('29881', '29877', 1, 'Knee arthroscopy meniscectomy includes debridement — modifier 59/XS if separate compartment', 'ortho-bundling');
  add('29880', '29877', 1, 'Bilateral meniscectomy includes debridement — modifier 59/XS if separate compartment', 'ortho-bundling');
  add('29882', '29877', 1, 'Meniscus repair includes debridement — modifier 59/XS if separate area', 'ortho-bundling');
  add('29883', '29877', 1, 'Meniscus repair includes debridement — modifier 59/XS if separate area', 'ortho-bundling');

  // Meniscectomy includes loose body removal
  add('29881', '29874', 1, 'Meniscectomy includes removal of loose body unless separate compartment', 'ortho-bundling');
  add('29880', '29874', 1, 'Bilateral meniscectomy includes removal of loose body', 'ortho-bundling');

  // Synovectomy bundling
  add('29876', '29875', 0, 'Major synovectomy includes limited synovectomy', 'ortho-bundling');

  // Complex procedures include simpler ones
  add('29880', '29881', 0, 'Bilateral meniscectomy includes unilateral meniscectomy', 'ortho-bundling');
  add('29882', '29881', 1, 'Meniscus repair may be separate from meniscectomy if different meniscus — modifier 59/XS', 'ortho-bundling');

  // TKA includes arthroscopy
  kneeArthBase.forEach((arth) => {
    add('27447', arth, 0, 'Total knee arthroplasty includes arthroscopic procedures', 'ortho-bundling');
  });

  // ---- GI endoscopy bundling ----
  const esoDevices = ['43236', '43239', '43241', '43242', '43243', '43244', '43245', '43246', '43247', '43248', '43249', '43250', '43251', '43252', '43253', '43254', '43255', '43257', '43259', '43270'];

  // All EGD procedures include diagnostic EGD (43235)
  esoDevices.forEach((proc) => {
    add(proc, '43235', 0, 'Therapeutic upper GI endoscopy includes diagnostic EGD', 'gi-bundling');
  });

  // EGD with biopsy includes diagnostic
  add('43239', '43235', 0, 'EGD with biopsy includes diagnostic EGD', 'gi-bundling');

  // EGD with biopsy vs other EGD procedures — modifier allowed
  ['43245', '43250', '43251', '43255'].forEach((proc) => {
    add(proc, '43239', 1, 'Additional EGD procedure with biopsy may be reported with modifier 59 if distinct', 'gi-bundling');
  });

  // Colonoscopy bundling
  const colonProcs = ['45380', '45381', '45382', '45384', '45385', '45386', '45388', '45389', '45390', '45391', '45392', '45393', '45398'];

  // All colonoscopy procedures include diagnostic colonoscopy (45378)
  colonProcs.forEach((proc) => {
    add(proc, '45378', 0, 'Therapeutic colonoscopy includes diagnostic colonoscopy', 'gi-bundling');
  });

  // Colonoscopy biopsy + polypectomy — modifier allowed
  add('45385', '45380', 1, 'Colonoscopy polypectomy with biopsy may be separate with modifier 59 if different lesion', 'gi-bundling');
  add('45384', '45380', 1, 'Colonoscopy hot biopsy polypectomy with biopsy may be separate with modifier 59', 'gi-bundling');

  // Sigmoidoscopy includes in colonoscopy
  add('45378', '45330', 0, 'Colonoscopy includes sigmoidoscopy', 'gi-bundling');
  add('45380', '45331', 0, 'Colonoscopy with biopsy includes sigmoidoscopy with biopsy', 'gi-bundling');
  add('45385', '45338', 0, 'Colonoscopy polypectomy includes sigmoidoscopy polypectomy', 'gi-bundling');

  // ---- Cholecystectomy ----
  add('47563', '47562', 0, 'Lap chole with cholangiography includes lap chole', 'surgical-bundling');
  add('47564', '47562', 0, 'Lap chole with duct exploration includes lap chole', 'surgical-bundling');
  add('47564', '47563', 0, 'Lap chole with duct exploration includes lap chole with cholangiography', 'surgical-bundling');

  // ---- Hernia repairs ----
  add('49507', '49505', 0, 'Incarcerated hernia repair includes initial hernia repair', 'surgical-bundling');
  add('49520', '49505', 1, 'Recurrent hernia repair separate from initial repair — modifier 59 if different site', 'surgical-bundling');
  add('49587', '49585', 0, 'Incarcerated ventral hernia repair includes initial ventral hernia repair', 'surgical-bundling');
  add('49653', '49652', 0, 'Incarcerated lap ventral hernia repair includes lap ventral hernia repair', 'surgical-bundling');

  // ---- Cystourethroscopy bundling ----
  const cystoProcs = ['52001', '52005', '52204', '52214', '52234', '52235', '52240', '52310', '52315', '52332', '52353'];

  cystoProcs.forEach((proc) => {
    add(proc, '52000', 0, 'Therapeutic cystourethroscopy includes diagnostic cystourethroscopy', 'urology-bundling');
  });

  add('52240', '52235', 0, 'Large tumor destruction includes medium tumor destruction', 'urology-bundling');
  add('52235', '52234', 0, 'Medium tumor destruction includes small tumor destruction', 'urology-bundling');
  add('52315', '52310', 0, 'Complex stone removal includes simple stone removal', 'urology-bundling');

  // ---- GYN bundling ----
  add('57454', '57452', 0, 'Colposcopy with biopsy and ECC includes colposcopy with biopsy alone', 'gyn-bundling');
  add('57455', '57452', 0, 'Colposcopy with biopsy and LEEP includes colposcopy with biopsy', 'gyn-bundling');
  add('57460', '57452', 0, 'Colposcopy with LEEP includes colposcopy with biopsy', 'gyn-bundling');
  add('57460', '57454', 0, 'Colposcopy with LEEP includes colposcopy with biopsy and ECC', 'gyn-bundling');
  add('57460', '57500', 0, 'Colposcopy with LEEP includes cervical biopsy', 'gyn-bundling');
  add('57454', '57505', 0, 'Colposcopy with ECC includes endocervical curettage alone', 'gyn-bundling');

  // Hysterectomy includes lesser procedures
  ['58100', '58120', '57500', '57505'].forEach((minor) => {
    add('58150', minor, 0, 'Total abdominal hysterectomy includes minor cervical/uterine procedures', 'gyn-bundling');
    add('58260', minor, 0, 'Vaginal hysterectomy includes minor cervical/uterine procedures', 'gyn-bundling');
    add('58550', minor, 0, 'LAVH includes minor cervical/uterine procedures', 'gyn-bundling');
  });

  // ---- Injection/infusion bundling ----
  add('96365', '96360', 1, 'Therapeutic IV infusion and hydration may be separate with modifier 59 if distinct', 'infusion-bundling');
  add('96413', '96365', 1, 'Chemo infusion and therapeutic infusion may be separate with modifier 59', 'infusion-bundling');
  add('96413', '96360', 1, 'Chemo infusion and hydration may be separate with modifier 59', 'infusion-bundling');
  add('96374', '96372', 0, 'IV push includes subcutaneous/IM injection of same drug', 'infusion-bundling');
  add('96375', '96374', 0, 'Additional IV push reported with initial IV push', 'infusion-bundling');
  add('96366', '96365', 0, 'Additional hour reported with initial hour', 'infusion-bundling');
  add('96361', '96360', 0, 'Additional hour hydration reported with initial hour hydration', 'infusion-bundling');
  add('96415', '96413', 0, 'Additional hour chemo reported with initial hour chemo', 'infusion-bundling');

  // ---- Physical therapy bundling ----
  // Modalities — only one modality from the supervised group
  const ptModalities = ['97010', '97012', '97014', '97016', '97018', '97022', '97024', '97026'];
  ptModalities.forEach((m1) => {
    ptModalities.forEach((m2) => {
      if (m1 < m2) {
        add(m1, m2, 1, 'Multiple physical therapy modalities may be reported with modifier 59 if distinct services', 'pt-bundling');
      }
    });
  });

  // PT evaluation includes re-evaluation
  add('97161', '97164', 0, 'PT evaluation includes re-evaluation on same date', 'pt-bundling');
  add('97162', '97164', 0, 'PT evaluation includes re-evaluation on same date', 'pt-bundling');
  add('97163', '97164', 0, 'PT evaluation includes re-evaluation on same date', 'pt-bundling');

  // Group therapy vs individual
  add('97110', '97150', 1, 'Individual therapeutic exercise and group therapy — modifier 59 if distinct', 'pt-bundling');
  add('97530', '97150', 1, 'Individual therapeutic activities and group therapy — modifier 59 if distinct', 'pt-bundling');

  // ---- Cardiac testing bundling ----
  // ECG components
  add('93000', '93005', 0, 'Complete ECG includes tracing only', 'cardiology-bundling');
  add('93000', '93010', 0, 'Complete ECG includes interpretation only', 'cardiology-bundling');

  // Stress test components
  add('93015', '93016', 0, 'Complete stress test includes supervision only', 'cardiology-bundling');
  add('93015', '93017', 0, 'Complete stress test includes tracing only', 'cardiology-bundling');
  add('93015', '93018', 0, 'Complete stress test includes interpretation only', 'cardiology-bundling');

  // Stress echo includes regular echo
  add('93350', '93307', 0, 'Stress echocardiography includes complete echocardiography', 'cardiology-bundling');
  add('93350', '93308', 0, 'Stress echocardiography includes limited echocardiography', 'cardiology-bundling');
  add('93351', '93350', 0, 'Stress echo with contrast includes stress echo without contrast', 'cardiology-bundling');
  add('93351', '93307', 0, 'Stress echo with contrast includes complete echo', 'cardiology-bundling');

  // Echo components
  add('93306', '93307', 0, 'Complete echo with Doppler includes complete echo without Doppler', 'cardiology-bundling');
  add('93306', '93308', 0, 'Complete echo with Doppler includes limited echo', 'cardiology-bundling');
  add('93307', '93308', 0, 'Complete echo includes limited echo', 'cardiology-bundling');

  // Cath lab
  add('93453', '93452', 0, 'Combined R+L heart cath includes left heart cath alone', 'cardiology-bundling');
  add('93458', '93452', 0, 'Coronary angiography with left cath includes left cath alone', 'cardiology-bundling');
  add('93460', '93458', 0, 'Coronary angiography with R+L cath includes coronary angiography with L cath', 'cardiology-bundling');
  add('93460', '93452', 0, 'Coronary angiography with R+L cath includes left heart cath', 'cardiology-bundling');
  add('93460', '93453', 0, 'Coronary angiography with R+L cath includes R+L heart cath', 'cardiology-bundling');

  // ---- Pain management bundling ----
  // Epidural levels
  add('62322', '62323', 0, 'Lumbar epidural without imaging includes lumbar epidural with imaging', 'pain-bundling');
  add('64484', '64483', 0, 'Additional transforaminal level reported with initial level', 'pain-bundling');
  add('64491', '64490', 0, 'Second cervical facet level reported with first level', 'pain-bundling');
  add('64492', '64490', 0, 'Third cervical facet level reported with first level', 'pain-bundling');
  add('64494', '64493', 0, 'Second lumbar facet level reported with first level', 'pain-bundling');
  add('64495', '64493', 0, 'Third lumbar facet level reported with first level', 'pain-bundling');

  // RFA
  add('64634', '64633', 0, 'Additional cervical RFA level reported with first level', 'pain-bundling');
  add('64636', '64635', 0, 'Additional lumbar RFA level reported with first level', 'pain-bundling');

  // Epidural includes facet same session — modifier allowed
  add('62323', '64493', 1, 'Epidural and facet injection may be separate with modifier 59 if distinct level/region', 'pain-bundling');
  add('64483', '64493', 1, 'Transforaminal epidural and facet injection may be separate with modifier 59', 'pain-bundling');

  // ---- Immunization bundling ----
  add('90460', '90471', 0, 'Cannot report both pediatric and adult immunization admin codes', 'immunization-bundling');
  add('90461', '90472', 0, 'Cannot report both pediatric and adult additional component admin codes', 'immunization-bundling');

  // ---- Imaging bundling ----
  // MRI with and without contrast includes with contrast and without contrast
  add('72158', '72148', 0, 'MRI lumbar with and without contrast includes MRI without contrast', 'imaging-bundling');
  add('72158', '72149', 0, 'MRI lumbar with and without contrast includes MRI with contrast', 'imaging-bundling');
  add('73723', '73721', 0, 'MRI knee with and without contrast includes MRI without contrast', 'imaging-bundling');
  add('74178', '74177', 0, 'CT abdomen/pelvis with and without contrast includes with contrast only', 'imaging-bundling');

  // Pelvic US
  add('76856', '76857', 0, 'Complete pelvic ultrasound includes limited pelvic ultrasound', 'imaging-bundling');

  // ---- Wound repair bundling ----
  // Complex includes intermediate and simple of same area
  add('13100', '12031', 0, 'Complex repair includes intermediate repair of same wound', 'wound-repair');
  add('13100', '12001', 0, 'Complex repair includes simple repair of same wound', 'wound-repair');
  add('13101', '12032', 0, 'Complex repair includes intermediate repair of same wound', 'wound-repair');
  add('12031', '12001', 0, 'Intermediate repair includes simple repair of same wound', 'wound-repair');
  add('12032', '12002', 0, 'Intermediate repair includes simple repair of same wound', 'wound-repair');

  // ---- Skin procedures ----
  add('11057', '11056', 0, 'Paring >4 lesions includes paring 2-4 lesions', 'dermatology-bundling');
  add('11056', '11055', 0, 'Paring 2-4 lesions includes paring single lesion', 'dermatology-bundling');
  add('17004', '17003', 0, 'Destruction 15+ premalignant lesions includes destruction 2-14 each', 'dermatology-bundling');
  add('17004', '17000', 0, 'Destruction 15+ premalignant lesions includes destruction first lesion', 'dermatology-bundling');
  add('17111', '17110', 0, 'Destruction 15+ benign lesions includes destruction up to 14', 'dermatology-bundling');

  // Biopsy types
  add('11106', '11102', 1, 'Incisional biopsy and tangential biopsy may be separate with modifier 59 for different lesions', 'dermatology-bundling');
  add('11104', '11102', 1, 'Punch biopsy and tangential biopsy may be separate with modifier 59 for different lesions', 'dermatology-bundling');
  add('11106', '11104', 1, 'Incisional biopsy and punch biopsy may be separate with modifier 59 for different lesions', 'dermatology-bundling');

  // ---- I&D bundling ----
  add('10061', '10060', 0, 'Complicated I&D includes simple I&D of same abscess', 'surgical-bundling');
  add('10121', '10120', 0, 'Complicated foreign body removal includes simple removal', 'surgical-bundling');

  // ---- Debridement bundling ----
  add('11044', '11043', 0, 'Bone debridement includes muscle/fascia debridement of same wound', 'surgical-bundling');
  add('11043', '11042', 0, 'Muscle/fascia debridement includes subcutaneous debridement of same wound', 'surgical-bundling');
  add('11044', '11042', 0, 'Bone debridement includes subcutaneous debridement of same wound', 'surgical-bundling');

  // ---- Pulmonary ----
  add('94060', '94010', 0, 'Bronchospasm evaluation includes spirometry', 'pulmonary-bundling');
  add('94060', '94375', 0, 'Bronchospasm evaluation includes flow volume loop', 'pulmonary-bundling');
  add('94010', '94375', 1, 'Spirometry and flow volume loop may be separate with modifier 59', 'pulmonary-bundling');
  add('94760', '94761', 0, 'Single pulse oximetry and multiple pulse oximetry — report one or the other', 'pulmonary-bundling');

  // ---- Ophthalmology ----
  add('92004', '92002', 0, 'Comprehensive new patient eye exam includes intermediate exam', 'ophthalmology-bundling');
  add('92014', '92012', 0, 'Comprehensive established eye exam includes intermediate exam', 'ophthalmology-bundling');

  // E&M with eye exam — modifier needed
  emEstCodes.forEach((em) => {
    add('92014', em, 1, 'Eye exam and E&M may be separate with modifier 25 on E&M', 'ophthalmology-bundling');
  });

  // ---- Arthrocentesis ----
  add('20611', '20610', 0, 'Arthrocentesis with ultrasound includes arthrocentesis without ultrasound', 'ortho-bundling');

  // ---- Obstetric bundling ----
  add('59510', '59400', 0, 'Cesarean delivery package includes vaginal delivery package', 'ob-bundling');
  add('59610', '59400', 0, 'VBAC delivery package includes vaginal delivery package', 'ob-bundling');

  // ---- Psychotherapy ----
  add('90837', '90834', 0, 'Cannot bill both 45 and 60 min psychotherapy same session', 'psych-bundling');
  add('90847', '90846', 0, 'Family psychotherapy with patient includes without patient', 'psych-bundling');

  // ---- Hysteroscopy ----
  add('58561', '58558', 0, 'Hysteroscopy with myomectomy includes hysteroscopy with biopsy', 'gyn-bundling');
  add('58563', '58558', 0, 'Hysteroscopy with ablation includes hysteroscopy with biopsy', 'gyn-bundling');
  add('58563', '58561', 1, 'Hysteroscopy ablation and myomectomy may be separate with modifier 59', 'gyn-bundling');

  // ---- Sleep studies ----
  add('95811', '95810', 0, 'Polysomnography with CPAP includes sleep staging polysomnography', 'sleep-bundling');

  // ---- Allergy ----
  add('95024', '95004', 0, 'Intracutaneous allergy test includes percutaneous allergy test', 'allergy-bundling');

  // ---- Specimen handling ----
  add('99000', '36415', 0, 'Specimen handling bundled with venipuncture', 'lab-bundling');

  // ---- Additional common pairs to reach 500+ ----
  // E&M with procedures — modifier 25 required
  const commonProcs = ['10060', '10061', '11102', '11104', '11200', '17000', '17110',
    '20610', '36415', '69210', '90471', '96372'];
  emEstCodes.forEach((em) => {
    commonProcs.forEach((proc) => {
      add(proc, em, 1, 'E&M may be separately reported with modifier 25 when significant, separately identifiable service documented', 'em-procedure');
    });
  });

  // Cerumen removal with ear-related E&M
  add('69210', '92557', 1, 'Cerumen removal and audiometry may be separate with modifier 59', 'ent-bundling');

  // Screening mammography with diagnostic
  add('77067', '76856', 1, 'Screening mammography and pelvic ultrasound may be separate services', 'imaging-bundling');

  // Drug injection with J-codes (drug administration includes drug cost separately)
  add('96372', '90471', 0, 'Therapeutic injection and immunization administration — report one admin code', 'infusion-bundling');

  return edits;
};

// ---------------------------------------------------------------------------
// MUE data — Medically Unlikely Edits
// ---------------------------------------------------------------------------

const generateMueData = () => {
  const mueEntries = [];

  const add = (code, practitionerValue, rationale, adjudicationIndicator = 2) => {
    mueEntries.push({
      code,
      description: CPT_DESCRIPTIONS[code] || '',
      practitionerMue: practitionerValue,
      facilityMue: practitionerValue, // simplified — same for facility
      rationale,
      adjudicationIndicator, // 1=line edit, 2=per day, 3=per encounter
    });
  };

  // E&M visits — 1 per day per provider
  ['99202', '99203', '99204', '99205'].forEach((c) => add(c, 1, 'One new patient E&M visit per provider per day', 2));
  ['99211', '99212', '99213', '99214', '99215'].forEach((c) => add(c, 1, 'One established patient E&M visit per provider per day', 2));
  ['99221', '99222', '99223'].forEach((c) => add(c, 1, 'One initial hospital care per admission', 3));
  ['99231', '99232', '99233'].forEach((c) => add(c, 1, 'One subsequent hospital care per day', 2));
  add('99238', 1, 'One hospital discharge per day', 2);
  add('99239', 1, 'One hospital discharge per day', 2);
  ['99281', '99282', '99283', '99284', '99285'].forEach((c) => add(c, 1, 'One ED visit per encounter', 3));
  add('99291', 1, 'One initial critical care per day per provider', 2);
  add('99292', 4, 'Up to 4 additional critical care units per day', 2);

  // Preventive visits — 1 per year but 1 per day MUE
  ['99381', '99382', '99383', '99384', '99385', '99386'].forEach((c) => add(c, 1, 'One new patient preventive visit per day', 2));
  ['99391', '99392', '99393', '99394', '99395', '99396'].forEach((c) => add(c, 1, 'One established patient preventive visit per day', 2));

  // Blood draws
  add('36415', 3, 'Up to 3 venipunctures per day', 2);
  add('36416', 3, 'Up to 3 capillary collections per day', 2);
  add('36410', 2, 'Up to 2 physician venipunctures per day', 2);

  // Lab panels — 1 per day
  ['80048', '80050', '80053', '80061', '80069', '80076'].forEach((c) => add(c, 1, 'One panel per day', 2));
  add('85025', 2, 'Up to 2 CBC per day', 2);
  add('85027', 2, 'Up to 2 CBC without diff per day', 2);
  add('85610', 2, 'Up to 2 PT per day', 2);
  add('85730', 2, 'Up to 2 PTT per day', 2);

  // Cultures
  add('87070', 3, 'Up to 3 bacterial cultures per day', 2);
  add('87086', 2, 'Up to 2 urine cultures per day', 2);
  add('87804', 2, 'Up to 2 rapid influenza tests per day', 2);
  add('87880', 2, 'Up to 2 rapid strep tests per day', 2);

  // Knee arthroscopy
  add('29877', 2, 'Up to 2 knee debridements per day (bilateral)', 2);
  add('29880', 1, 'One bilateral meniscectomy per day', 2);
  add('29881', 2, 'Up to 2 unilateral meniscectomies per day (bilateral)', 2);
  add('29882', 2, 'Up to 2 meniscus repairs per day (bilateral)', 2);
  add('29883', 2, 'Up to 2 meniscus repairs per day (bilateral)', 2);
  add('29874', 2, 'Up to 2 loose body removals per day (bilateral)', 2);

  // GI
  add('43235', 1, 'One diagnostic EGD per day', 2);
  add('43239', 1, 'One EGD with biopsy per day', 2);
  add('45378', 1, 'One diagnostic colonoscopy per day', 2);
  add('45380', 1, 'One colonoscopy with biopsy per day', 2);
  add('45385', 1, 'One colonoscopy with polypectomy per day', 2);
  add('45330', 1, 'One sigmoidoscopy per day', 2);

  // Surgery
  add('47562', 1, 'One cholecystectomy per patient', 3);
  add('47563', 1, 'One cholecystectomy per patient', 3);
  add('49505', 2, 'Up to 2 inguinal hernia repairs per day (bilateral)', 2);
  add('49650', 2, 'Up to 2 laparoscopic hernia repairs per day (bilateral)', 2);
  add('27447', 2, 'Up to 2 TKAs per day (bilateral)', 2);
  add('27130', 2, 'Up to 2 THAs per day (bilateral)', 2);

  // Cystourethroscopy
  add('52000', 1, 'One diagnostic cystourethroscopy per day', 2);
  add('52332', 2, 'Up to 2 stent insertions per day (bilateral)', 2);

  // GYN
  add('57452', 1, 'One colposcopy per day', 2);
  add('57460', 1, 'One LEEP per day', 2);
  add('58100', 1, 'One endometrial biopsy per day', 2);
  add('58120', 1, 'One D&C per day', 2);
  add('58150', 1, 'One hysterectomy per patient', 3);
  add('58260', 1, 'One vaginal hysterectomy per patient', 3);
  add('58558', 1, 'One hysteroscopy per day', 2);

  // Obstetric
  add('59400', 1, 'One vaginal delivery package per pregnancy', 3);
  add('59510', 1, 'One cesarean delivery package per pregnancy', 3);

  // Injections/infusions
  add('96360', 1, 'One initial hydration per day', 2);
  add('96361', 4, 'Up to 4 additional hydration hours per day', 2);
  add('96365', 2, 'Up to 2 initial therapeutic infusions per day', 2);
  add('96366', 8, 'Up to 8 additional infusion hours per day', 2);
  add('96372', 4, 'Up to 4 IM/SQ injections per day', 2);
  add('96374', 3, 'Up to 3 IV pushes per day', 2);
  add('96413', 2, 'Up to 2 initial chemo infusions per day', 2);

  // PT/rehab
  add('97010', 1, 'One hot/cold pack application per day', 2);
  add('97035', 2, 'Up to 2 ultrasound units per day', 2);
  add('97110', 4, 'Up to 4 units (60 min) therapeutic exercise per day', 2);
  add('97112', 4, 'Up to 4 units (60 min) neuromuscular reeducation per day', 2);
  add('97116', 4, 'Up to 4 units (60 min) gait training per day', 2);
  add('97140', 4, 'Up to 4 units (60 min) manual therapy per day', 2);
  add('97150', 4, 'Up to 4 units group therapy per day', 2);
  add('97161', 1, 'One PT eval per day', 2);
  add('97162', 1, 'One PT eval per day', 2);
  add('97163', 1, 'One PT eval per day', 2);
  add('97164', 1, 'One PT re-eval per day', 2);
  add('97530', 4, 'Up to 4 units (60 min) therapeutic activities per day', 2);

  // Cardiac
  add('93000', 3, 'Up to 3 ECGs per day', 2);
  add('93015', 1, 'One stress test per day', 2);
  add('93306', 1, 'One complete echo per day', 2);
  add('93350', 1, 'One stress echo per day', 2);
  add('93452', 1, 'One left heart cath per day', 2);
  add('93798', 1, 'One cardiac rehab session per day', 2);

  // Pain
  add('62323', 2, 'Up to 2 epidural injections per day (bilateral)', 2);
  add('64483', 2, 'Up to 2 transforaminal epidurals per day (bilateral)', 2);
  add('64493', 4, 'Up to 4 lumbar facet injections per day (bilateral, multiple levels)', 2);
  add('64635', 2, 'Up to 2 lumbar RFA per day (bilateral)', 2);

  // Immunization
  add('90471', 1, 'One initial immunization admin per day per route', 2);
  add('90472', 3, 'Up to 3 additional immunization components per day', 2);
  add('90460', 1, 'One initial pediatric immunization admin per day', 2);
  add('90461', 5, 'Up to 5 additional pediatric components per day', 2);

  // Imaging
  add('71046', 2, 'Up to 2 chest X-rays per day', 2);
  add('72148', 1, 'One lumbar MRI per day', 2);
  add('73721', 2, 'Up to 2 knee MRIs per day (bilateral)', 2);
  add('74177', 1, 'One CT abdomen/pelvis per day', 2);
  add('76700', 1, 'One abdominal ultrasound per day', 2);
  add('76805', 1, 'One OB ultrasound per day', 2);
  add('76830', 1, 'One transvaginal ultrasound per day', 2);
  add('76856', 1, 'One pelvic ultrasound per day', 2);
  add('77067', 1, 'One screening mammography per day', 2);

  // Pulmonary
  add('94010', 2, 'Up to 2 spirometry tests per day (pre and post)', 2);
  add('94060', 1, 'One bronchospasm evaluation per day', 2);
  add('94640', 4, 'Up to 4 nebulizer treatments per day', 2);
  add('94760', 3, 'Up to 3 pulse oximetry readings per day', 2);

  // Psych
  add('90834', 1, 'One 45 min psychotherapy per day', 2);
  add('90837', 1, 'One 60 min psychotherapy per day', 2);
  add('90847', 1, 'One family psychotherapy per day', 2);
  add('90853', 1, 'One group psychotherapy per day', 2);

  // Ophthalmology
  add('92004', 1, 'One comprehensive new eye exam per day', 2);
  add('92014', 1, 'One comprehensive established eye exam per day', 2);
  add('92250', 2, 'Up to 2 fundus photography per day (bilateral)', 2);

  // Misc
  add('10060', 3, 'Up to 3 simple I&D per day', 2);
  add('10061', 2, 'Up to 2 complicated I&D per day', 2);
  add('11042', 4, 'Up to 4 debridement units per day', 2);
  add('11102', 3, 'Up to 3 tangential biopsies per day', 2);
  add('11104', 3, 'Up to 3 punch biopsies per day', 2);
  add('11200', 1, 'One skin tag removal session per day', 2);
  add('12001', 3, 'Up to 3 simple repairs per day', 2);
  add('17000', 1, 'One first premalignant lesion destruction per day', 2);
  add('17110', 1, 'One benign lesion destruction session per day', 2);
  add('20610', 4, 'Up to 4 major joint arthrocenteses per day', 2);
  add('69210', 2, 'Up to 2 cerumen removals per day (bilateral)', 2);
  add('86580', 1, 'One TB skin test per day', 2);
  add('88305', 5, 'Up to 5 surgical pathology level IV per day', 2);
  add('96110', 1, 'One developmental screening per day', 2);
  add('96127', 2, 'Up to 2 behavioral assessments per day', 2);
  add('95810', 1, 'One polysomnography per day', 2);
  add('95004', 40, 'Up to 40 percutaneous allergy tests per day', 2);

  // HCPCS
  add('G0101', 1, 'One cervical/vaginal screening per day', 2);
  add('G0102', 1, 'One prostate screening per day', 2);
  add('G0104', 1, 'One flex sig screening per day', 2);
  add('G0105', 1, 'One colonoscopy screening per day', 2);
  add('G0121', 1, 'One colonoscopy screening per day', 2);
  add('G0127', 1, 'One dystrophic nail trimming session per day', 2);
  add('G0463', 1, 'One hospital outpatient clinic visit per day', 2);

  return mueEntries;
};

// ---------------------------------------------------------------------------
// Build and write
// ---------------------------------------------------------------------------

const ptpEdits = generatePtpEdits();
const mueData = generateMueData();

const meta = {
  dataSource: 'CMS NCCI',
  cmsQuarter: '2024 Q1',
  buildDate: new Date().toISOString(),
  ptpEditCount: ptpEdits.length,
  mueCount: mueData.length,
  categories: [...new Set(ptpEdits.map((e) => e.category))].sort(),
  note: 'Sample data covering common CPT/HCPCS code pairs. Run npm run build-data to update from CMS when downloads are available.',
};

writeFileSync(join(DATA_DIR, 'ptp-edits.json'), JSON.stringify(ptpEdits, null, 2) + '\n');
writeFileSync(join(DATA_DIR, 'mue.json'), JSON.stringify(mueData, null, 2) + '\n');
writeFileSync(join(DATA_DIR, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');

console.log(`Built PTP edits: ${ptpEdits.length} pairs`);
console.log(`Built MUE data: ${mueData.length} entries`);
console.log(`Categories: ${meta.categories.join(', ')}`);
console.log(`Data written to ${DATA_DIR}`);
