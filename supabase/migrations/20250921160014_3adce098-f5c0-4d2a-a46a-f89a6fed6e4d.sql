-- Create restaurants table for caching
CREATE TABLE public.restaurants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  rating DECIMAL(2,1),
  price_level INTEGER,
  formatted_address TEXT,
  location JSONB, -- {lat, lng}
  photos TEXT[],
  opening_hours JSONB,
  phone_number TEXT,
  website TEXT,
  types TEXT[],
  reviews JSONB, -- Array of review objects
  veg_only BOOLEAN DEFAULT FALSE,
  jain_food BOOLEAN DEFAULT FALSE,
  menu JSONB, -- [{name:"Dish Name", veg:true}, ...]
  cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create AI summaries table
CREATE TABLE public.restaurant_ai_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id TEXT NOT NULL UNIQUE,
  rank_score INTEGER NOT NULL CHECK (rank_score >= 0 AND rank_score <= 100),
  short_summary TEXT NOT NULL,
  pros TEXT[] NOT NULL,
  cons TEXT[] NOT NULL,
  dishes_to_try TEXT[] NOT NULL DEFAULT '{}',
  matching_menu_items TEXT[] NOT NULL DEFAULT '{}',
  top_positive_quote TEXT,
  top_negative_quote TEXT,
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user searches table for analytics
CREATE TABLE public.user_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  search_location JSONB NOT NULL, -- {lat, lng, address}
  filters JSONB, -- {max_price, cuisine, veg_only, jain_food, menu, max_distance}
  results_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_ai_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_searches ENABLE ROW LEVEL SECURITY;

-- Create policies (public read access for restaurants data, no auth required)
CREATE POLICY "Restaurants are publicly readable" 
ON public.restaurants 
FOR SELECT 
USING (true);

CREATE POLICY "AI summaries are publicly readable" 
ON public.restaurant_ai_summaries 
FOR SELECT 
USING (true);

-- Only backend functions can write to these tables
CREATE POLICY "Only backend can insert restaurants" 
ON public.restaurants 
FOR INSERT 
WITH CHECK (false);

CREATE POLICY "Only backend can update restaurants" 
ON public.restaurants 
FOR UPDATE 
USING (false);

CREATE POLICY "Only backend can insert AI summaries" 
ON public.restaurant_ai_summaries 
FOR INSERT 
WITH CHECK (false);

CREATE POLICY "Only backend can update AI summaries" 
ON public.restaurant_ai_summaries 
FOR UPDATE 
USING (false);

-- User searches can be inserted by anyone (anonymous usage tracking)
CREATE POLICY "Anyone can insert searches" 
ON public.user_searches 
FOR INSERT 
WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_restaurants_place_id ON public.restaurants(place_id);
CREATE INDEX idx_restaurants_cached_at ON public.restaurants(cached_at);
CREATE INDEX idx_ai_summaries_place_id ON public.restaurant_ai_summaries(place_id);
CREATE INDEX idx_restaurants_location ON public.restaurants USING GIN(location);

-- Indexes for veg/jain filtering
CREATE INDEX idx_restaurants_veg_only ON public.restaurants(veg_only) WHERE veg_only = TRUE;
CREATE INDEX idx_restaurants_jain_food ON public.restaurants(jain_food) WHERE jain_food = TRUE;

-- Index for menu JSONB
CREATE INDEX idx_restaurants_menu ON public.restaurants USING GIN (menu);

-- Indexes for AI summary dishes
CREATE INDEX idx_ai_dishes_to_try ON public.restaurant_ai_summaries USING GIN (dishes_to_try);
CREATE INDEX idx_ai_matching_menu_items ON public.restaurant_ai_summaries USING GIN (matching_menu_items);

-- Create function to clean old cache (older than 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM public.restaurants 
  WHERE cached_at < NOW() - INTERVAL '24 hours';
  
  DELETE FROM public.restaurant_ai_summaries 
  WHERE generated_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_restaurants_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_summaries_updated_at
  BEFORE UPDATE ON public.restaurant_ai_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
