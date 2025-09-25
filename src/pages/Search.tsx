import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { MapPin, Search as SearchIcon, Loader2, Star, DollarSign, Clock, Phone, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LocationService } from '@/lib/location-service';
import { RestaurantCard } from '@/components/RestaurantCard';
import { supabase } from '@/integrations/supabase/client';
import heroImage from '@/assets/hero-food.jpg';

interface Restaurant {
  id: string;
  place_id: string;
  name: string;
  rating: number;
  price_level: number;
  formatted_address: string;
  location: { lat: number; lng: number };
  photos?: string[];
  phone_number?: string;
  website?: string;
  types?: string[];
  ai_summary?: {
    rank_score: number;
    short_summary: string;
    pros: string[];
    cons: string[];
    top_positive_quote?: string;
    top_negative_quote?: string;
    confidence: number;
  };
}

interface SearchFilters {
  maxPrice: number;
  maxDistance: number;
  cuisine: string[];
  vegOnly: boolean;
  jainFood: boolean;
}



const CUISINE_OPTIONS = [
  'Italian', 'Mexican', 'Chinese', 'Japanese', 'Indian', 'Thai', 'American', 
  'French', 'Mediterranean', 'Korean', 'Vietnamese', 'Greek', 'Spanish'
];

const RestaurantSearch = () => {
  const [location, setLocation] = useState('');
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    maxPrice: 4,
    maxDistance: 10,
    cuisine: [],
    vegOnly: false,
    jainFood: false,
    menu: []
  });
  
  const { toast } = useToast();

  const handleLocationSearch = async () => {
    if (!location.trim() && !currentLocation) {
      toast({
        title: "Location Required",
        description: "Please enter a location or use your current location.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    
    try {
      const locationToSearch = currentLocation ? `${currentLocation.lat},${currentLocation.lng}` : location.trim();
      
      console.log('Searching with location:', locationToSearch);
      
      // Track user search
      await supabase.from('user_searches').insert({
        search_location: {
          lat: currentLocation?.lat,
          lng: currentLocation?.lng,
          address: location
        } as any,
        filters: filters as any
      });

      const searchParams = {
        location: locationToSearch,
        radius: filters.maxDistance * 1000, // meters
        max_price: filters.maxPrice,
        cuisine: filters.cuisine.join(','),
        veg_only: filters.vegOnly,
        jain_food: filters.jainFood
      };



      console.log('Search params:', searchParams);

      const { data, error } = await supabase.functions.invoke('search-restaurants', {
        body: searchParams
      });

      console.log('Search response:', data, error);

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Search failed');
      }

      if (data?.error) {
        console.error('Backend error:', data.error);
        throw new Error(data.error);
      }

      setRestaurants(data.restaurants || []);
      
      toast({
        title: "Search Complete",
        description: `Found ${data.restaurants?.length || 0} restaurants nearby!`,
      });
      
    } catch (error: any) {
      console.error('Search error:', error);
      
      // Don't clear the location input on error
      const errorMessage = error.message || 'There was an error searching for restaurants. Please try again.';
      
      toast({
        title: "Search Failed",
        description: errorMessage.includes('Unable to find location') 
          ? "Unable to find the specified location. Please check the spelling or try a different location."
          : errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      const position = await LocationService.getCurrentPosition();
      setCurrentLocation({ lat: position.lat, lng: position.lng });
      setLocation(`${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`);
      
      toast({
        title: "Location Found",
        description: "Using your current location for search.",
      });
    } catch (error) {
      toast({
        title: "Location Error",
        description: "Unable to get your location. Please enter it manually.",
        variant: "destructive",
      });
    } finally {
      setIsGettingLocation(false);
    }
  };

  const toggleCuisine = (cuisine: string) => {
    setFilters(prev => ({
      ...prev,
      cuisine: prev.cuisine.includes(cuisine)
        ? prev.cuisine.filter(c => c !== cuisine)
        : [...prev.cuisine, cuisine]
    }));
  };

  const getPriceDisplay = (level: number) => {
    return ''.repeat(level || 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/85 to-background/95" />
        </div>
        
        <div className="relative container mx-auto px-4 py-20">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl font-bold text-foreground mb-6">
              Find Your Perfect
              <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent"> Restaurant</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Discover amazing dining experiences near you, powered by AI analysis of real reviews and ratings.
            </p>
            
            {/* Search Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Location Section - Left Side */}
              <Card className="shadow-warm border-0 bg-card/80 backdrop-blur-sm md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    Location
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter city, address, or zip code..."
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleLocationSearch()}
                      className="flex-1"
                    />
                    <Button 
                      variant="location" 
                      onClick={handleUseCurrentLocation}
                      disabled={isGettingLocation}
                    >
                      {isGettingLocation ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <MapPin className="w-4 h-4" />
                      )}
                      Use My Location
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Filters - Right Side */}
              <Card className="shadow-warm border-0 bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SearchIcon className="w-5 h-5 text-primary" />
                    Quick Filters
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant={filters.vegOnly ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilters(prev => ({ ...prev, vegOnly: !prev.vegOnly }))}
                      className="flex-1"
                    >
                      🥬 Vegetarian
                    </Button>
                    <Button
                      variant={filters.maxPrice <= 2 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilters(prev => ({ ...prev, maxPrice: prev.maxPrice <= 2 ? 4 : 2 }))}
                      className="flex-1"
                    >
                      💰 Budget-Friendly
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Search Button - Full Width Below */}
              <div className="md:col-span-3">
                <Button 
                  variant="hero" 
                  size="lg" 
                  onClick={handleLocationSearch}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Searching Restaurants...
                    </>
                  ) : (
                    <>
                      <SearchIcon className="w-4 h-4 mr-2" />
                      Find Restaurants
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filters Section */}
      {hasSearched && (
        <section className="container mx-auto px-4 py-8">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Refine Your Search</CardTitle>
              <CardDescription>Customize your dining preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Price Range */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Price Range: {getPriceDisplay(filters.maxPrice)}
                </label>
                <Slider
                  value={[filters.maxPrice]}
                  onValueChange={([value]) => setFilters(prev => ({ ...prev, maxPrice: value }))}
                  max={4}
                  min={1}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Budget</span>
                  <span>Moderate</span>
                  <span>Upscale</span>
                  <span>Fine Dining</span>
                </div>
              </div>

              {/* Distance */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Maximum Distance: {filters.maxDistance} km
                </label>
                <Slider
                  value={[filters.maxDistance]}
                  onValueChange={([value]) => setFilters(prev => ({ ...prev, maxDistance: value }))}
                  max={25}
                  min={1}
                  step={1}
                  className="w-full"
                />
              </div>
              {/* Veg / Jain Toggle */}
                <div className="flex gap-4 items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.vegOnly}
                      onChange={(e) => setFilters(prev => ({ ...prev, vegOnly: e.target.checked }))}
                      className="form-checkbox"
                    />
                    Veg Only
                  </label>
                </div>

              {/* Cuisine Types */}
              <div>
                <label className="text-sm font-medium mb-2 block">Cuisine Types</label>
                <div className="flex flex-wrap gap-2">
                  {CUISINE_OPTIONS.map((cuisine) => (
                    <Badge
                      key={cuisine}
                      variant={filters.cuisine.includes(cuisine) ? "default" : "outline"}
                      className="cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => toggleCuisine(cuisine)}
                    >
                      {cuisine}
                    </Badge>
                  ))}
                </div>
              </div>

              <Button onClick={handleLocationSearch} disabled={isLoading} className="w-full">
                Update Results
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Results Section */}
      {hasSearched && (
        <section className="container mx-auto px-4 pb-12">
          {restaurants.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">
                  Found {restaurants.length} Restaurant{restaurants.length !== 1 ? 's' : ''}
                </h2>
                <p className="text-muted-foreground">Ranked by AI analysis & ratings</p>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {restaurants.map((restaurant) => (
                  <RestaurantCard key={restaurant.id} restaurant={restaurant} />
                ))}
              </div>
            </>
          ) : !isLoading && (
            <Card className="text-center py-12">
              <CardContent>
                <SearchIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No restaurants found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search location or filters to find more options.
                </p>
              </CardContent>
            </Card>
          )}
        </section>
      )}
    </div>
  );
};

export default RestaurantSearch;