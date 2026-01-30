-- Add new standard sub-process node types to the workflow_node_type enum
ALTER TYPE workflow_node_type ADD VALUE IF NOT EXISTS 'sub_process_standard_direct';
ALTER TYPE workflow_node_type ADD VALUE IF NOT EXISTS 'sub_process_standard_manager';
ALTER TYPE workflow_node_type ADD VALUE IF NOT EXISTS 'sub_process_standard_validation1';
ALTER TYPE workflow_node_type ADD VALUE IF NOT EXISTS 'sub_process_standard_validation2';