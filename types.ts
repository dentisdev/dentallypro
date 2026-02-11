
export enum VisualType {
  IMAGE = 'IMAGE'
}

export enum LabMode {
  SURGERY = 'SURGERY',
  EXPLODED = 'EXPLODED',
  XRAY_VISION = 'XRAY_VISION',
  MICROSCOPE = 'MICROSCOPE',
  ANALYSIS = 'ANALYSIS'
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface Hotspot {
  x: number; 
  y: number; 
  label: string;
  description: string;
  diagnosis: string;
  indications: string;
  classification: string;
  treatmentPlan: string;
  clinicalPearl?: string; 
  commonMistake?: string; 
}

export interface Vitals {
  heartRate: number;
  bloodPressure: string;
  oxygenSaturation: number;
}

export interface InstrumentSpec {
  name: string;
  isoNumber: string;
  useCase: string;
}

export interface PracticalStep {
  id: string;
  title: string;
  originalText: string; // 1. النص الأصلي
  medicalTranslation: string; // 2. الترجمة الطبية الدقيقة
  professorComment: string; // 3. الشرح العميق (متوسط الطول)
  memoryAid: string; // 4. اسلوب الحفظ الفكاهي
  visualPrompt?: string; // 5. وصف الصورة (للتوليد)
  imageUrl?: string; // الصورة المولدة
  imageStatus?: 'pending' | 'loading' | 'completed' | 'failed'; // حالة توليد الصورة
  
  // Optional legacy fields
  practicalAction?: string;
  instrumentation?: string;
  tactileFeedback?: string;
  warning?: string;
  commonMistake?: string;
}

export interface DangerZone {
  name: string;
  riskLevel: 'HIGH' | 'MODERATE' | 'LOW';
  description: string;
  box: { ymin: number; xmin: number; ymax: number; xmax: number };
}

export interface ImageAnalysisResult {
  isHighQuality: boolean;
  rejectionReason?: string;
  detailedClinicalAnalysis: string;
  landmarks: string[];
  dangerZones: DangerZone[];
  adaCompliance: {
    compliant: boolean;
    notes: string;
  };
}

export interface VisualParameter {
  componentId: string;
  colorHex: string;
  spatialPosition?: { x: number; y: number; z: number };
}

export interface StructuralComponent {
  partName: string;
}

export interface ModelMetadata {
  entityName: string;
  scientificClassification: string;
}

export interface TechnicalBlueprint {
  visualParameters?: VisualParameter[];
  structuralComponents?: StructuralComponent[];
  modelMetadata?: ModelMetadata;
}

export interface QuizItem {
  id: string;
  question: string;
  answer: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Intellectual';
  keyPoints?: string[];
}

export interface MCQItem {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Intellectual';
}

export interface QuizData {
  essayQuestions: QuizItem[];
  shortAnswerQuestions: QuizItem[];
  mcqQuestions: MCQItem[];
}

export interface ClinicalData {
  theorySummary?: string;
  practicalProtocol?: PracticalStep[];
  differentialDiagnosis?: string[];
  requiredInstruments?: InstrumentSpec[];
  imagePrompt?: string;
  radiologyPrompt?: string;
  explodedPrompt?: string;
  hotspots?: Hotspot[];
  riskLevel?: string;
  vitals?: Vitals;
  analysisResult?: ImageAnalysisResult;
  quizData?: QuizData;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  visual?: string;
  clinicalData?: ClinicalData;
  sources?: GroundingChunk[];
}
