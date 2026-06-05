-- Create test data for photo upload testing
DO $$
DECLARE
  v_user_id uuid;
  v_plant_id uuid := gen_random_uuid();
  v_action_type_id uuid;
  v_action_id uuid := gen_random_uuid();
BEGIN
  -- Get first user
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found. Please sign up via /auth/signup first.';
  END IF;

  -- Get "Watered" action type
  SELECT id INTO v_action_type_id FROM action_types WHERE name = 'Watered' LIMIT 1;
  
  IF v_action_type_id IS NULL THEN
    RAISE EXCEPTION 'No action types found. Run migrations first.';
  END IF;

  -- Create test plant
  INSERT INTO plants (id, user_id, name, species)
  VALUES (v_plant_id, v_user_id, 'Test Monstera', 'Monstera deliciosa')
  ON CONFLICT (id) DO NOTHING;

  -- Create test action
  INSERT INTO actions (id, plant_id, action_type_id, notes)
  VALUES (v_action_id, v_plant_id, v_action_type_id, 'Test action for photo upload')
  ON CONFLICT (id) DO NOTHING;

  -- Output IDs
  RAISE NOTICE 'User ID: %', v_user_id;
  RAISE NOTICE 'Plant ID: %', v_plant_id;
  RAISE NOTICE 'Action ID: %', v_action_id;
END $$;

-- Show created data
SELECT 
  p.id as plant_id,
  p.name as plant_name,
  a.id as action_id,
  at.name as action_type
FROM plants p
JOIN actions a ON a.plant_id = p.id
JOIN action_types at ON at.id = a.action_type_id
ORDER BY a.created_at DESC
LIMIT 5;