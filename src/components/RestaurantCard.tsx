import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Star, MapPin, DollarSign, Phone, Globe, ChevronDown, ChevronUp, Clock, ThumbsUp, ThumbsDown } from 'lucide-react';

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
    dishes_to_try?: string[];
  };
}

interface RestaurantCardProps {
  restaurant: Restaurant;
}

export const RestaurantCard: React.FC<RestaurantCardProps> = ({ restaurant }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getPriceDisplay = (level: number) => {
    return '$'.repeat(level || 1);
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-green-600';
    if (rating >= 4.0) return 'text-green-500';
    if (rating >= 3.5) return 'text-yellow-500';
    if (rating >= 3.0) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const formatCuisineTypes = (types: string[]) => {
    const foodTypes = types?.filter(type => 
      !['establishment', 'point_of_interest'].includes(type) &&
      type.includes('restaurant') === false
    ).slice(0, 3);
    
    return foodTypes?.map(type => 
      type.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    ) || [];
  };

  return (
    <Card className="group hover:shadow-warm transition-all duration-300 hover:-translate-y-1 border-0 shadow-md overflow-hidden">
      {/* Photo Header */}
      {restaurant.photos && restaurant.photos.length > 0 && (
        <div className="h-48 bg-gradient-to-br from-primary/10 to-primary/5 relative overflow-hidden">
          <img 
            src={restaurant.photos[0]} 
            alt={restaurant.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute top-3 right-3">
            {restaurant.ai_summary && (
              <Badge className={`${getScoreColor(restaurant.ai_summary.rank_score)} text-white border-0`}>
                AI Score: {restaurant.ai_summary.rank_score}
              </Badge>
            )}
          </div>
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-2">
              {restaurant.name}
            </CardTitle>
          </div>

          {/* Rating and Price */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Star className={`w-4 h-4 fill-current ${getRatingColor(restaurant.rating)}`} />
              <span className={`font-semibold ${getRatingColor(restaurant.rating)}`}>
                {restaurant.rating?.toFixed(1) || 'N/A'}
              </span>
            </div>
            
            <div className="flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-primary">
                {getPriceDisplay(restaurant.price_level)}
              </span>
            </div>
          </div>

          {/* Cuisine Types */}
          {restaurant.types && (
            <div className="flex flex-wrap gap-1">
              {formatCuisineTypes(restaurant.types).map((type, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {type}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* AI Summary */}
        {restaurant.ai_summary && (
          <div className="bg-gradient-to-r from-primary/5 to-primary-glow/5 p-3 rounded-lg border border-primary/10">
            <p className="text-sm text-foreground font-medium leading-relaxed">
              {restaurant.ai_summary.short_summary}
            </p>
            {restaurant.ai_summary.confidence && (
              <p className="text-xs text-muted-foreground mt-1">
                Confidence: {Math.round(restaurant.ai_summary.confidence * 100)}%
              </p>
            )}
          </div>
        )}

        {/* Location */}
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <span className="text-sm text-muted-foreground line-clamp-2">
            {restaurant.formatted_address}
          </span>
        </div>

        {/* Expandable Details */}
        {restaurant.ai_summary && (restaurant.ai_summary.pros.length > 0 || restaurant.ai_summary.cons.length > 0) && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                <span className="text-sm font-medium">AI Analysis Details</span>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="space-y-3 mt-3">
            {restaurant.ai_summary?.dishes_to_try?.length > 0 && (
              <div className="mt-2">
                <h4 className="font-medium text-sm">Recommended Dishes:</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  {restaurant.ai_summary.dishes_to_try.map((dish, idx) => (
                    <li key={idx}>{dish}</li>
                  ))}
                </ul>
              </div>
            )}

              {/* Pros */}
              {restaurant.ai_summary.pros.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ThumbsUp className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-600">What People Love</span>
                  </div>
                  <ul className="space-y-1">
                    {restaurant.ai_summary.pros.map((pro, index) => (
                      <li key={index} className="text-sm text-muted-foreground ml-6">
                        • {pro}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Cons */}
              {restaurant.ai_summary.cons.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ThumbsDown className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-600">Areas for Improvement</span>
                  </div>
                  <ul className="space-y-1">
                    {restaurant.ai_summary.cons.map((con, index) => (
                      <li key={index} className="text-sm text-muted-foreground ml-6">
                        • {con}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quotes */}
              {restaurant.ai_summary.top_positive_quote && (
                <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm italic text-green-800 dark:text-green-200">
                    "{restaurant.ai_summary.top_positive_quote}"
                  </p>
                </div>
              )}

              {restaurant.ai_summary.top_negative_quote && (
                <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                  <p className="text-sm italic text-orange-800 dark:text-orange-200">
                    "{restaurant.ai_summary.top_negative_quote}"
                  </p>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {restaurant.phone_number && (
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <a href={`tel:${restaurant.phone_number}`}>
                <Phone className="w-4 h-4" />
                Call
              </a>
            </Button>
          )}
          
          {restaurant.website && (
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <a href={restaurant.website} target="_blank" rel="noopener noreferrer">
                <Globe className="w-4 h-4" />
                Website
              </a>
            </Button>
          )}
          
          <Button variant="default" size="sm" className="flex-1" asChild>
            <a 
              href={`https://www.google.com/maps/place/?q=place_id:${restaurant.place_id}`}
              target="_blank" 
              rel="noopener noreferrer"
            >
              <MapPin className="w-4 h-4" />
              Directions
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};