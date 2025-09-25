import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchParams {
  location: string;           // "lat,lng" or address
  radius?: number;
  max_price?: number;
  cuisine?: string;
  veg_only?: boolean;
  jain_food?: boolean;
  menu?: string[];            // New field: dishes user wants
}


interface PlaceDetails {
  place_id: string;
  name: string;
  rating: number;
  price_level: number;
  formatted_address: string;
  geometry: {
    location: { lat: number; lng: number };
  };
  photos?: Array<{ photo_reference: string }>;
  opening_hours?: any;
  formatted_phone_number?: string;
  website?: string;
  types: string[];
  reviews?: Array<{
    text: string;
    rating: number;
    time: number;
  }>;
}

interface GeminiAnalysis {
  place_id: string;
  rank_score: number;
  short_summary: string;
  pros: string[];
  cons: string[];
  dishes_to_try?: string[];
  matching_menu_items?: string[];   // New field
  top_positive_quote?: string;
  top_negative_quote?: string;
  confidence: number;
}


serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!googleApiKey || !geminiApiKey) {
      throw new Error('Missing required API keys');
    }

    const { location, radius = 5000, max_price = 4, cuisine = '', veg_only = false, jain_food = false, menu = [] }: SearchParams = await req.json();

    console.log('Search params:', { location, radius, max_price, cuisine, veg_only, jain_food, menu });

    // Step 1: Convert location to coordinates if needed
    let coordinates: { lat: number; lng: number };
    
    if (location.includes(',') && /^-?\d+\.?\d*,-?\d+\.?\d*$/.test(location.trim())) {
      // Already coordinates (lat,lng format)
      const [lat, lng] = location.split(',').map(parseFloat);
      if (isNaN(lat) || isNaN(lng)) {
        throw new Error('Invalid coordinate format');
      }
      coordinates = { lat, lng };
    } else {
      // Geocode the address
      console.log(`Geocoding address: "${location}"`);
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${googleApiKey}`;
      const geocodeResponse = await fetch(geocodeUrl);
      const geocodeData = await geocodeResponse.json();
      
      console.log(`Geocoding result: ${geocodeData.status}`, geocodeData.results?.[0]?.formatted_address);
      
      if (geocodeData.status !== 'OK' || !geocodeData.results[0]) {
        const errorMsg = geocodeData.status === 'ZERO_RESULTS' 
          ? `Unable to find location "${location}". Please try a more specific address or city name.`
          : `Geocoding failed: ${geocodeData.status}`;
        throw new Error(errorMsg);
      }
      
      coordinates = geocodeData.results[0].geometry.location;
    }

    console.log('Using coordinates:', coordinates);

    // Step 2: Search for nearby restaurants
    let placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${coordinates.lat},${coordinates.lng}&radius=${radius}&type=restaurant&key=${googleApiKey}`;
    
    if (max_price < 4) {
      placesUrl += `&maxprice=${max_price}`;
    }

    const placesResponse = await fetch(placesUrl);
    const placesData = await placesResponse.json();

    if (placesData.status !== 'OK') {
      throw new Error(`Places API error: ${placesData.status}`);
    }

    console.log(`Found ${placesData.results.length} restaurants`);

    // Step 3: Get detailed information for each restaurant
    const restaurantPromises = placesData.results.slice(0, 25).map(async (place: any) => {
      try {
        // Check cache first
        const { data: cachedRestaurant } = await supabaseClient
          .from('restaurants')
          .select('*')
          .eq('place_id', place.place_id)
          .gte('cached_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24h
          .single();

        let restaurantData;
        
        if (cachedRestaurant) {
          console.log(`Using cached data for ${place.name}`);
          restaurantData = cachedRestaurant;
        } else {
          // Fetch place details
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,rating,price_level,formatted_address,geometry,photos,opening_hours,formatted_phone_number,website,types,reviews&key=${googleApiKey}`;
          
          const detailsResponse = await fetch(detailsUrl);
          const detailsData = await detailsResponse.json();
          
          if (detailsData.status !== 'OK') {
            console.warn(`Failed to get details for ${place.name}: ${detailsData.status}`);
            return null;
          }

          const details: PlaceDetails = detailsData.result;

          // Process photos
          const photos = details.photos?.slice(0, 3).map(photo => 
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${googleApiKey}`
          ) || [];

          // Create restaurant object
          restaurantData = {
            place_id: details.place_id,
            name: details.name,
            rating: details.rating,
            price_level: details.price_level,
            formatted_address: details.formatted_address,
            location: details.geometry.location,
            photos,
            phone_number: details.formatted_phone_number,
            website: details.website,
            types: details.types,
            reviews: details.reviews || [],
            cached_at: new Date().toISOString()
          };

          // Cache the restaurant data
          await supabaseClient
            .from('restaurants')
            .upsert(restaurantData, { onConflict: 'place_id' });

          console.log(`Cached restaurant data for ${details.name}`);
        }

        // Step 4: Get or generate AI summary
        const { data: cachedSummary } = await supabaseClient
          .from('restaurant_ai_summaries')
          .select('*')
          .eq('place_id', restaurantData.place_id)
          .gte('generated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .single();

        let aiSummary;

        if (cachedSummary) {
          console.log(`Using cached AI summary for ${restaurantData.name}`);
          aiSummary = cachedSummary;
        } else if (restaurantData.reviews && restaurantData.reviews.length > 0) {
          // Generate AI analysis using Gemini
          const reviewTexts = restaurantData.reviews
        .filter((review: any) => review.text && review.text.length > 20)
        .slice(0, 12) // take more reviews if available
        .map((review: any) => review.text);


          if (reviewTexts.length > 0) {
            const analysisPrompt = `You are an assistant that MUST return JSON only.
Make sure this summary is unique for ${restaurantData.name} and not copied from other restaurants based ONLY on the provided reviews, rating, price_level, and cuisine.
Do not invent facts. Do not copy summaries across restaurants.
Summaries must be short (max 2 sentences).
Include a list of suggested dishes to try based on reviews and filters (veg_only if selected).
Also, if user has provided a menu, highlight matching dishes from the menu that the restaurant offers.

Input:
{
  "place_id": "${restaurantData.place_id}",
  "name": "${restaurantData.name}",
  "rating": ${restaurantData.rating},
  "price_level": ${restaurantData.price_level},
  "cuisine": "${restaurantData.types?.join(', ')}",
  "address": "${restaurantData.formatted_address}",
  "reviews": ${JSON.stringify(reviewTexts)},
  "filters": ${JSON.stringify({ veg_only, jain_food, menu })}


Output (strict JSON):
{
  "place_id": "${restaurantData.place_id}",
  "rank_score": <0-100>,
  "short_summary": "<1-2 sentences based on reviews, rating, hygiene>",
  "pros": ["...","..."],
  "cons": ["...","..."],
  "dishes_to_try": ["Dish 1","Dish 2","Dish 3"],
  "matching_menu_items": ["Dish from user menu if available"],
  "top_positive_quote": "<short excerpt>",
  "top_negative_quote": "<short excerpt>",
  "confidence": <0-1>
}`;


            try {
              const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=' + geminiApiKey, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  contents: [{
                    parts: [{
                      text: analysisPrompt
                    }]
                  }],
                  generationConfig: {
                    temperature: 0.2,
                    topK: 1,
                    topP: 0.8,
                    maxOutputTokens: 1000,
                  }
                })
              });

              const geminiData = await geminiResponse.json();

              // Log full Gemini response
              console.log('Gemini full response:', JSON.stringify(geminiData, null, 2));

              if (geminiData.candidates && geminiData.candidates[0]) {
                const responseText = geminiData.candidates[0].content.parts[0].text;
                
                // Log the raw text Gemini returned
                console.log('Gemini raw text output:', responseText);

                // Clean JSON (remove ```json if Gemini wrapped it)
                const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                
                // Log cleaned text before parsing
                console.log('Gemini cleaned JSON text:', cleanJson);

                try {
                  const analysis: GeminiAnalysis = JSON.parse(cleanJson);
                  console.log('Gemini parsed JSON:', analysis);
   
                  // Validate and save AI summary
                  aiSummary = {
                    place_id: analysis.place_id,
                    rank_score: Math.max(0, Math.min(100, analysis.rank_score)),
                    short_summary: analysis.short_summary,
                    pros: Array.isArray(analysis.pros) ? analysis.pros : [],
                    cons: Array.isArray(analysis.cons) ? analysis.cons : [],
                    top_positive_quote: analysis.top_positive_quote,
                    top_negative_quote: analysis.top_negative_quote,
                    confidence: Math.max(0, Math.min(1, analysis.confidence)),
                    generated_at: new Date().toISOString()
                  };

                  await supabaseClient
                    .from('restaurant_ai_summaries')
                    .upsert(aiSummary, { onConflict: 'place_id' });

                  console.log(`Generated AI summary for ${restaurantData.name}`);
                } catch (parseError) {
                  console.warn(`Failed to parse Gemini response for ${restaurantData.name}:`, parseError);
                }
              }
            } catch (geminiError) {
              console.warn(`Gemini API error for ${restaurantData.name}:`, geminiError);
            }
          }
        }

        return {
          id: restaurantData.place_id,
          place_id: restaurantData.place_id,
          name: restaurantData.name,
          rating: restaurantData.rating,
          price_level: restaurantData.price_level,
          formatted_address: restaurantData.formatted_address,
          location: restaurantData.location,
          photos: restaurantData.photos,
          phone_number: restaurantData.phone_number,
          website: restaurantData.website,
          types: restaurantData.types,
          ai_summary: aiSummary ? {
            rank_score: aiSummary.rank_score,
            short_summary: aiSummary.short_summary,
            pros: aiSummary.pros,
            cons: aiSummary.cons,
            top_positive_quote: aiSummary.top_positive_quote,
            top_negative_quote: aiSummary.top_negative_quote,
            confidence: aiSummary.confidence
          } : undefined
        };

      } catch (error) {
        console.error(`Error processing ${place.name}:`, error);
        return null;
      }
    });

    const restaurants = (await Promise.all(restaurantPromises)).filter(Boolean);

    // Step 5: Rank restaurants
    const rankedRestaurants = restaurants
      .map((restaurant: any) => {
        let totalScore = 0;
        
        // Google rating (0-50 points)
        if (restaurant.rating) {
          totalScore += (restaurant.rating / 5) * 50;
        }
        
        // AI rank score (0-30 points)
        if (restaurant.ai_summary?.rank_score) {
          totalScore += (restaurant.ai_summary.rank_score / 100) * 30;
        }
        
        // Price fit (0-20 points) - closer to max_price gets more points
        if (restaurant.price_level) {
          const priceFit = 1 - Math.abs(restaurant.price_level - max_price) / 4;
          totalScore += priceFit * 20;
        }
        
        return {
          ...restaurant,
          total_score: Math.round(totalScore)
        };
      })
      .sort((a: any, b: any) => b.total_score - a.total_score);

    console.log(`Returning ${rankedRestaurants.length} ranked restaurants`);

    return new Response(
      JSON.stringify({ 
        restaurants: rankedRestaurants,
        search_location: coordinates,
        total_found: rankedRestaurants.length 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in search-restaurants function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        restaurants: [],
        total_found: 0 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});