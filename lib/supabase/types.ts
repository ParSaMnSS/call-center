export type CallStatus = "pending" | "transcribing" | "analyzing" | "done" | "failed";
export type Sentiment = "positive" | "neutral" | "negative";

export interface Call {
  id: string;
  created_at: string;
  uploaded_by: string | null;
  audio_path: string;
  audio_duration_sec: number | null;
  status: CallStatus;
  processing_started_at: string | null;
  processing_seconds: number | null;
  original_filename: string | null;
  error_message: string | null;
  transcript: string | null;
  caller_name: string | null;
  caller_phone: string | null;
  agent_name: string | null;
  issue_summary: string | null;
  resolved: boolean | null;
  category: string | null;
  tags: string[] | null;
  agent_behavior: string | null;
  caller_behavior: string | null;
  sentiment_agent: Sentiment | null;
  sentiment_caller: Sentiment | null;
  follow_up_needed: boolean | null;
  notes: string | null;
}
