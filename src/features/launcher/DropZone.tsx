import { createSignal } from 'solid-js';

interface DropZoneProps {
  onDrop: (file: File) => void;
  onClick: () => void;
}

export function DropZone(props: DropZoneProps) {
  const [isDragOver, setIsDragOver] = createSignal(false);

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: DragEvent) {
    if (e.relatedTarget instanceof Node && e.currentTarget instanceof Element && e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragOver(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer?.files[0];
    if (!file || !file.name.endsWith('.json')) return;
    props.onDrop(file);
  }

  return (
    <div
      class={`launcher-dropzone${isDragOver() ? ' drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={props.onClick}
    >
      <span class="launcher-dropzone-text">
        or drag &amp; drop a .json project file here
      </span>
    </div>
  );
}
