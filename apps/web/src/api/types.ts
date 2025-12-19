export type Prompt = {
  id: string;
  title: string;
  promptText: string;
  genres: string[];
  styles: string[];
  moods: string[];
  createdAt?: string;
  imageUrl?: string;
  source?: { name?: string; url?: string };
};

export type FacetItem = { value: string; count: number };

export type Facets = {
  genres: FacetItem[];
  styles: FacetItem[];
  moods: FacetItem[];
};

export type PromptsListResponse = {
  items: Prompt[];
  page: number;
  pageSize: number;
  total: number;
  facets: Facets;
};


