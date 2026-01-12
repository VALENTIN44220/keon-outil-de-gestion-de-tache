export interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  default_process_template_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryWithSubcategories extends Category {
  subcategories: Subcategory[];
}
