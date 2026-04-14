export interface Constraint {
  has_constraint: boolean;
  name: string;
  type: "NominalScaledType" | "OrdinalScaledType";
  required_values: string[];
  min_value?: string;
  max_value?: string;
}

export interface AttributeData {
  attribute_name: string;
  attribute_path: string;
  current_value: string | null;
  editable: boolean;
  constraints: Constraint[];
  sub_attributes: AttributeData[];
  editor_id?: string;
}

export interface ElementData {
  element_name: string;
  element_id: string;
  element_description: string | null;
  attributes: AttributeData[];
  children: ElementData[];
}

export interface HierarchyData {
  instance_hierarchy: string;
  elements: ElementData[];
}
