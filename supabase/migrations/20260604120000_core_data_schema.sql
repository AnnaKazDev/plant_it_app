-- Core Database Schema: plants, actions, action_types, photos, profiles
-- Migration created: 2026-06-04

-- 1. profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  location_lat DECIMAL(9, 6),
  location_lng DECIMAL(9, 6),
  garden_width DECIMAL(5, 2) CHECK (garden_width > 0),
  garden_height DECIMAL(5, 2) CHECK (garden_height > 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. plants table
CREATE TABLE public.plants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) <= 200),
  photo_url TEXT,
  grid_x INTEGER NOT NULL CHECK (grid_x >= 0),
  grid_y INTEGER NOT NULL CHECK (grid_y >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. action_types table
CREATE TABLE public.action_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK (char_length(name) <= 100),
  icon_emoji TEXT NOT NULL CHECK (char_length(icon_emoji) <= 10),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. actions table
CREATE TABLE public.actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  action_type_id UUID REFERENCES public.action_types(id) ON DELETE RESTRICT,
  custom_action_name TEXT CHECK (char_length(custom_action_name) <= 300),
  date TIMESTAMPTZ NOT NULL,
  weather_data JSONB,
  additional_data TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT action_name_check CHECK (
    (action_type_id IS NOT NULL AND custom_action_name IS NULL) OR
    (action_type_id IS NULL AND custom_action_name IS NOT NULL)
  )
);

-- 5. photos table
CREATE TABLE public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES public.actions(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  order_index INTEGER NOT NULL CHECK (order_index >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (action_id, order_index)
);

-- 6. Indexes
CREATE INDEX idx_plants_user_id ON public.plants(user_id);
CREATE INDEX idx_actions_plant_id ON public.actions(plant_id);
CREATE INDEX idx_actions_action_type_id ON public.actions(action_type_id);
CREATE INDEX idx_photos_action_id ON public.photos(action_id);

-- 7. RLS policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_insert ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY profiles_delete ON public.profiles FOR DELETE USING (auth.uid() = id);

-- plants policies
CREATE POLICY plants_select ON public.plants FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY plants_insert ON public.plants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY plants_update ON public.plants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY plants_delete ON public.plants FOR DELETE USING (auth.uid() = user_id);

-- action_types policies (read-only for all authenticated users)
CREATE POLICY action_types_select ON public.action_types FOR SELECT TO authenticated USING (true);

-- actions policies (via plant_id → plants.user_id)
CREATE POLICY actions_select ON public.actions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.plants WHERE plants.id = actions.plant_id AND plants.user_id = auth.uid())
);
CREATE POLICY actions_insert ON public.actions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.plants WHERE plants.id = actions.plant_id AND plants.user_id = auth.uid())
);
CREATE POLICY actions_update ON public.actions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.plants WHERE plants.id = actions.plant_id AND plants.user_id = auth.uid())
);
CREATE POLICY actions_delete ON public.actions FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.plants WHERE plants.id = actions.plant_id AND plants.user_id = auth.uid())
);

-- photos policies (via action_id → actions.plant_id → plants.user_id)
CREATE POLICY photos_select ON public.photos FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.actions
    JOIN public.plants ON plants.id = actions.plant_id
    WHERE actions.id = photos.action_id AND plants.user_id = auth.uid()
  )
);
CREATE POLICY photos_insert ON public.photos FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.actions
    JOIN public.plants ON plants.id = actions.plant_id
    WHERE actions.id = photos.action_id AND plants.user_id = auth.uid()
  )
);
CREATE POLICY photos_update ON public.photos FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.actions
    JOIN public.plants ON plants.id = actions.plant_id
    WHERE actions.id = photos.action_id AND plants.user_id = auth.uid()
  )
);
CREATE POLICY photos_delete ON public.photos FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.actions
    JOIN public.plants ON plants.id = actions.plant_id
    WHERE actions.id = photos.action_id AND plants.user_id = auth.uid()
  )
);

-- 8. Seed action_types (30 common gardening actions with emoji icons)
INSERT INTO public.action_types (name, icon_emoji) VALUES
  ('watering', '💧'),
  ('fertilizing', '🌱'),
  ('pruning', '✂️'),
  ('planted_from_seed', '🌰'),
  ('transplanting', '🪴'),
  ('repotting', '🏺'),
  ('pest_control', '🐛'),
  ('disease_treatment', '💊'),
  ('weeding', '🌿'),
  ('mulching', '🍂'),
  ('staking', '🪵'),
  ('harvesting', '🌽'),
  ('deadheading', '🥀'),
  ('pinching', '👌'),
  ('thinning', '🌾'),
  ('dividing', '✂️'),
  ('propagating', '🌱'),
  ('composting', '♻️'),
  ('soil_testing', '🧪'),
  ('sun_exposure_change', '☀️'),
  ('shade_added', '⛱️'),
  ('frost_protection', '❄️'),
  ('heat_protection', '🔥'),
  ('wind_protection', '💨'),
  ('support_structure', '🏗️'),
  ('seed_collection', '🌾'),
  ('cleaning_leaves', '🧹'),
  ('top_dressing', '🌿'),
  ('observation_only', '👀'),
  ('general_care', '🛠️')
ON CONFLICT (name) DO NOTHING;
