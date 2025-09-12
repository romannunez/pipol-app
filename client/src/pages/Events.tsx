import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { eventCategoryEnum } from "@shared/schema";

export default function Events() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  // Fetch events
  const { data: events, isLoading, error } = useQuery({
    queryKey: ['/api/events'],
    retry: 1
  });

  // Filter events based on search term and category
  const filteredEvents = events ? events.filter((event: any) => {
    const matchesSearch = searchTerm === "" || 
      event.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.locationName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === "" || event.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  }) : [];

  return (
    <div className="container mx-auto py-10 px-4">
      <header className="mb-12">
        <h1 className="text-3xl font-bold mb-4">Discover Events</h1>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="w-full md:w-64">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {eventCategoryEnum.enumValues.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="text-center py-10">
          <p>Loading events...</p>
        </div>
      ) : error ? (
        <div className="text-center py-10">
          <p className="text-red-500">Failed to load events</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Try Again
          </Button>
        </div>
      ) : filteredEvents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event: any) => (
            <Card key={event.id} className="overflow-hidden flex flex-col">
              {event.mainMediaUrl && (
                <div className="aspect-video w-full overflow-hidden bg-gray-100">
                  <img 
                    src={event.mainMediaUrl} 
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="line-clamp-1">{event.title}</CardTitle>
                    <CardDescription>
                      {new Date(event.date).toLocaleDateString()} • {event.locationName}
                    </CardDescription>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                    {event.category}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="line-clamp-3 text-gray-600">{event.description}</p>
                <div className="mt-4 flex items-center text-sm text-gray-500">
                  <span className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {event.attendees?.length || 0} attendees
                  </span>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <Link to={`/events/${event.id}`}>
                  <Button>View Details</Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-10">
          <h3 className="text-xl font-semibold mb-2">No events found</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || selectedCategory 
              ? "Try adjusting your filters" 
              : "There are no events available at the moment"}
          </p>
          {(searchTerm || selectedCategory) && (
            <Button onClick={() => { setSearchTerm(""); setSelectedCategory(""); }}>
              Clear Filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}