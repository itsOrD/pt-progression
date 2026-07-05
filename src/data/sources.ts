export type Source = {
  id: string;
  label: string;
  url: string;
  keyPoint: string;
};

export const SOURCES: Record<string, Source> = {
  nice: {
    id: "nice",
    label: "NICE NG59 — Low back pain and sciatica",
    url: "https://www.nice.org.uk/guidance/ng59/chapter/Recommendations",
    keyPoint:
      "Encourages self-management, continuing normal activities, and exercise matched to your needs and capability. Routine imaging is not recommended for nonspecific low-back pain.",
  },
  nhs: {
    id: "nhs",
    label: "NHS — Back pain",
    url: "https://www.nhs.uk/conditions/back-pain/",
    keyPoint:
      "Back pain often improves within weeks. Stay active, avoid prolonged bed rest, heat can help. Red flags include bilateral symptoms, saddle numbness, bladder/bowel changes, fever, and serious trauma.",
  },
  acp: {
    id: "acp",
    label: "ACP 2017 guideline (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/28192789/",
    keyPoint:
      "Acute/subacute low-back pain often improves over time. Superficial heat has moderate-quality evidence. Nonpharmacologic treatment is preferred first for chronic pain.",
  },
  aaos: {
    id: "aaos",
    label: "AAOS OrthoInfo — Spine Conditioning Program",
    url: "https://orthoinfo.aaos.org/en/recovery/spine-conditioning-program/",
    keyPoint:
      "Warm up before exercise, strengthen the muscles that support the spine (bird dog, planks, bridges, bracing), stretch after strengthening, and do not push through pain.",
  },
  choosept: {
    id: "choosept",
    label: "ChoosePT (APTA) — Low Back Pain Guide",
    url: "https://www.choosept.com/guide/physical-therapy-guide-low-back-pain",
    keyPoint:
      "PTs use education and prescribed movement. Acute low-back pain often resolves but can recur — stay active, resume normal routine, and get evaluated if symptoms worsen or persist.",
  },
  walking: {
    id: "walking",
    label: "Walking & recurrence (WalkBack trial explainer)",
    url: "https://www.theguardian.com/society/article/2024/jun/19/walking-three-times-a-week-nearly-halves-recurrence-of-low-back-pain",
    keyPoint:
      "A structured walking + education program roughly halved recurrence of low-back pain and extended pain-free time. Walking is a core pillar, not filler.",
  },
};

export const SOURCE_LIST: Source[] = Object.values(SOURCES);
