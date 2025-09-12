import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { insertEventSchema, eventCategoryEnum, privacyTypeEnum } from "@shared/schema";
import { z } from "zod";

// Create a new schema for the form that handles client-side validation
const createEventFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  category: z.enum(eventCategoryEnum.enumValues),
  date: z.string().min(1, "Please select a date and time"),
  latitude: z.string().min(1, "Latitude is required"),
  longitude: z.string().min(1, "Longitude is required"),
  locationName: z.string().min(3, "Location name is required"),
  locationAddress: z.string().min(5, "Location address is required"),
  privacyType: z.enum(privacyTypeEnum.enumValues).default("public"),
  maxCapacity: z.string().optional(),
});

type CreateEventFormValues = z.infer<typeof createEventFormSchema>;

export default function CreateEvent() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if user is authenticated
  const { data: user, isLoading: isUserLoading } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
    refetchOnWindowFocus: false
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<CreateEventFormValues>({
    resolver: zodResolver(createEventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "social",
      date: "",
      latitude: "",
      longitude: "",
      locationName: "",
      locationAddress: "",
      privacyType: "public",
      maxCapacity: "",
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (formData: CreateEventFormValues) => {
      // Transform form data for the API
      const eventData = {
        ...formData,
        // Convert maxCapacity to number or null
        maxCapacity: formData.maxCapacity ? parseInt(formData.maxCapacity) : null,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        organizerId: user.id,
      };

      const response = await apiRequest("POST", "/api/events", eventData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create event");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Event created successfully",
        description: "Your event has been created and is now live.",
      });
      setLocation(`/events/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Failed to create event",
        description: error instanceof Error ? error.message : "An error occurred while creating your event",
        variant: "destructive",
      });
    },
  });

  async function onSubmit(data: CreateEventFormValues) {
    setIsSubmitting(true);
    try {
      await createEventMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Mock function to simulate location search 
  // This would be replaced with a real API call to Google Maps
  const handleLocationSearch = async (searchTerm: string) => {
    // Simulate API call
    if (searchTerm.length > 3) {
      // Set mock values for demonstration
      setValue('locationName', 'Central Park');
      setValue('locationAddress', '59th to 110th St., New York, NY 10022');
      setValue('latitude', '40.785091');
      setValue('longitude', '-73.968285');
    }
  };

  // Redirect to login if user is not authenticated
  if (!isUserLoading && !user) {
    setLocation("/login");
    return null;
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Create Event</h1>
          <Link to="/events">
            <Button variant="outline">Cancel</Button>
          </Link>
        </div>
        <p className="text-gray-600 mt-2">Fill out the form below to create a new event</p>
      </header>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title</Label>
              <Input
                id="title"
                placeholder="Give your event a name"
                {...register("title")}
              />
              {errors.title && (
                <p className="text-sm text-red-500">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select 
                defaultValue="social" 
                onValueChange={(value) => setValue('category', value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {eventCategoryEnum.enumValues.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-red-500">{errors.category.message}</p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your event. What should attendees expect?"
                rows={5}
                {...register("description")}
              />
              {errors.description && (
                <p className="text-sm text-red-500">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date & Time</Label>
              <Input
                id="date"
                type="datetime-local"
                {...register("date")}
              />
              {errors.date && (
                <p className="text-sm text-red-500">{errors.date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxCapacity">Maximum Capacity (Optional)</Label>
              <Input
                id="maxCapacity"
                type="number"
                placeholder="Leave blank for unlimited"
                {...register("maxCapacity")}
              />
              {errors.maxCapacity && (
                <p className="text-sm text-red-500">{errors.maxCapacity.message}</p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="locationSearch">Location Search</Label>
              <div className="flex gap-2">
                <Input
                  id="locationSearch"
                  placeholder="Search for a location"
                  onChange={(e) => handleLocationSearch(e.target.value)}
                />
                <Button type="button" variant="outline">Search</Button>
              </div>
              <p className="text-sm text-gray-500">
                Start typing to search for a location. This would normally use Google Maps API.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="locationName">Location Name</Label>
              <Input
                id="locationName"
                placeholder="e.g. Central Park"
                {...register("locationName")}
              />
              {errors.locationName && (
                <p className="text-sm text-red-500">{errors.locationName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="locationAddress">Address</Label>
              <Input
                id="locationAddress"
                placeholder="Full address of the venue"
                {...register("locationAddress")}
              />
              {errors.locationAddress && (
                <p className="text-sm text-red-500">{errors.locationAddress.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                placeholder="e.g. 40.785091"
                {...register("latitude")}
              />
              {errors.latitude && (
                <p className="text-sm text-red-500">{errors.latitude.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                placeholder="e.g. -73.968285"
                {...register("longitude")}
              />
              {errors.longitude && (
                <p className="text-sm text-red-500">{errors.longitude.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="privacyType">Privacy</Label>
              <Select 
                defaultValue="public" 
                onValueChange={(value) => setValue('privacyType', value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select privacy type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public (Anyone can view and join)</SelectItem>
                  <SelectItem value="private">Private (Invitation only)</SelectItem>
                </SelectContent>
              </Select>
              {errors.privacyType && (
                <p className="text-sm text-red-500">{errors.privacyType.message}</p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
              {isSubmitting ? "Creating Event..." : "Create Event"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}