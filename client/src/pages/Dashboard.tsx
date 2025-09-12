import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";

export default function Dashboard() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  // Check if user is authenticated
  const { data: user, isLoading: isUserLoading, error: userError } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
    refetchOnWindowFocus: false
  });

  // Fetch user's created events
  const { data: createdEvents, isLoading: isCreatedEventsLoading } = useQuery({
    queryKey: ['/api/events/created'],
    enabled: !!user,
    retry: false
  });

  // Fetch user's attending events
  const { data: attendingEvents, isLoading: isAttendingEventsLoading } = useQuery({
    queryKey: ['/api/events/attending'],
    enabled: !!user,
    retry: false
  });

  const handleLogout = async () => {
    try {
      const response = await apiRequest("POST", "/api/auth/logout", {});
      
      if (response.ok) {
        toast({
          title: "Logged out successfully",
        });
        setLocation("/");
      } else {
        throw new Error("Logout failed");
      }
    } catch (error) {
      toast({
        title: "Logout failed",
        description: "An error occurred while logging out",
        variant: "destructive",
      });
    }
  };

  // If not authenticated, redirect to login
  if (userError) {
    setLocation("/login");
    return null;
  }

  // Show loading state
  if (isUserLoading) {
    return (
      <div className="container mx-auto py-10 px-4 text-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user?.name}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/events/create">
            <Button>Create Event</Button>
          </Link>
          <Button variant="outline" onClick={handleLogout}>Log Out</Button>
        </div>
      </header>

      <Tabs defaultValue="attending" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="attending">Events I'm Attending</TabsTrigger>
          <TabsTrigger value="created">Events I've Created</TabsTrigger>
          <TabsTrigger value="profile">My Profile</TabsTrigger>
        </TabsList>
        
        <TabsContent value="attending">
          {isAttendingEventsLoading ? (
            <p>Loading events...</p>
          ) : attendingEvents && attendingEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {attendingEvents.map((attendance: any) => (
                <Card key={attendance.id}>
                  <CardHeader>
                    <CardTitle>{attendance.event.title}</CardTitle>
                    <CardDescription>
                      {new Date(attendance.event.date).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-3">{attendance.event.description}</p>
                  </CardContent>
                  <CardFooter>
                    <Link to={`/events/${attendance.event.id}`}>
                      <Button variant="outline">View Details</Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <h3 className="text-xl font-semibold mb-2">You're not attending any events yet</h3>
              <p className="text-gray-600 mb-6">Discover and join events that interest you</p>
              <Link to="/events">
                <Button>Browse Events</Button>
              </Link>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="created">
          {isCreatedEventsLoading ? (
            <p>Loading events...</p>
          ) : createdEvents && createdEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {createdEvents.map((event: any) => (
                <Card key={event.id}>
                  <CardHeader>
                    <CardTitle>{event.title}</CardTitle>
                    <CardDescription>
                      {new Date(event.date).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-3">{event.description}</p>
                    <p className="mt-2 text-sm text-gray-500">
                      {event.attendees?.length || 0} attendees
                    </p>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Link to={`/events/${event.id}`}>
                      <Button variant="outline">View</Button>
                    </Link>
                    <Link to={`/events/${event.id}/edit`}>
                      <Button variant="outline">Edit</Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <h3 className="text-xl font-semibold mb-2">You haven't created any events yet</h3>
              <p className="text-gray-600 mb-6">Start creating your first event</p>
              <Link to="/events/create">
                <Button>Create Event</Button>
              </Link>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Manage your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium">Name</h4>
                <p>{user?.name}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium">Username</h4>
                <p>{user?.username}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium">Email</h4>
                <p>{user?.email}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium">Bio</h4>
                <p>{user?.bio || "No bio added yet"}</p>
              </div>
            </CardContent>
            <CardFooter>
              <Link to="/profile/edit">
                <Button>Edit Profile</Button>
              </Link>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}