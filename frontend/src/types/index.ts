export interface User {
  id: number;
  username: string;
  display_name: string;
  role: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Product {
  id: number;
  name: string;
  top_notes: string;
  middle_notes: string;
  base_notes: string;
  price: number;
  spec: string;
  scenarios: string[];
  brand_story: string;
  image_url: string;
  created_at: string;
  updated_at: string;
}

export interface StyleFeatures {
  tone?: string;
  vocabulary?: string[];
  sentence_patterns?: string[];
  emoji_style?: string;
  structure?: string;
  emotional_expression?: string;
  title_style?: string;
  paragraph_style?: string;
  summary?: string;
}

export interface StyleSource {
  id: number;
  style_id: number;
  platform: string;
  source_url: string;
  source_content: string;
  created_at: string;
}

export interface Style {
  id: number;
  name: string;
  description: string;
  style_features: StyleFeatures;
  sources?: StyleSource[];
  source_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Scene {
  id: number;
  name: string;
  type: string;
  description: string;
  keywords: string[];
  prompt_hint: string;
  is_builtin: boolean;
  created_at: string;
}

export interface GeneratedCopy {
  id: number;
  user_id: number;
  product_id: number;
  style_id: number;
  scene_id: number | null;
  title: string;
  content: string;
  hashtags: string[];
  version: number;
  batch_id: string;
  is_favorite: boolean;
  rating: number | null;
  created_at: string;
  product_name: string;
  style_name: string;
  scene_name: string;
}

export type GeneratePlatform = "xiaohongshu" | "wechat_moments" | "douyin" | "video_script";

export type ModelChoice = "gemini" | "deepseek" | "kimi";

export interface AsyncTask {
  id: string;
  type: string;
  status: string;
  progress: number;
  result?: Record<string, unknown>;
  error?: string;
}
