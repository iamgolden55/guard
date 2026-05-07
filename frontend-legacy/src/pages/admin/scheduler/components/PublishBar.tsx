import React from 'react';
import { Send, Eye } from 'lucide-react';
import { Button } from '../../../../components/ui/button';

interface Props {
  draftCount: number;
  isPublishing: boolean;
  onPublish: () => void;
}

export const PublishBar: React.FC<Props> = ({ draftCount, isPublishing, onPublish }) => {
  if (draftCount === 0) return null;

  return (
    <div className="sticky bottom-0 z-20 flex items-center justify-between px-4 py-3 bg-amber-50 border-t border-amber-200">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-sm font-medium text-amber-800">
          {draftCount} unpublished shift{draftCount !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-amber-600">
          — Staff will not see these until published
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPublish}
          disabled={isPublishing}
          className="gap-1.5"
        >
          <Send className="h-3.5 w-3.5" />
          {isPublishing ? 'Publishing...' : 'Publish All'}
        </Button>
      </div>
    </div>
  );
};
