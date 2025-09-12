import { useState } from "react";
import { Button } from "@/components/ui/button";
import EditEventSheet from "@/components/events/edit-event-sheet";

const TestEditPanel = () => {
  const [editEventId, setEditEventId] = useState<number | null>(6); // Default to event ID 6
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);

  // Open edit sheet for a specific event
  const handleOpenEditSheet = () => {
    console.log("Opening edit sheet for event:", editEventId);
    setIsEditSheetOpen(true);
  };
  
  // Close edit sheet
  const handleCloseEditSheet = () => {
    setIsEditSheetOpen(false);
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-8">Test Edit Event Panel</h1>
      <Button 
        onClick={handleOpenEditSheet}
        className="bg-primary text-white"
      >
        Open Edit Panel
      </Button>
      
      {/* Event ID Input */}
      <div className="mt-4">
        <label className="block text-sm font-medium mb-2">Event ID:</label>
        <input 
          type="number" 
          value={editEventId || ""}
          onChange={(e) => setEditEventId(parseInt(e.target.value) || null)}
          className="border border-gray-300 p-2 rounded-md"
        />
      </div>
      
      {/* Edit Event Sheet */}
      {editEventId && (
        <EditEventSheet 
          eventId={editEventId} 
          isOpen={isEditSheetOpen} 
          onClose={handleCloseEditSheet}
        />
      )}
    </div>
  );
};

export default TestEditPanel;