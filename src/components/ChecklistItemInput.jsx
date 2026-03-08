import React, { useState } from "react";

const ChecklistItemInput = React.memo(({ onAdd }) => {
  const [text, setText] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button 
        className="t-btn-gray" 
        style={{ width: 'fit-content', padding: '6px 12px', fontSize: '14px' }} 
        onClick={() => setIsOpen(true)}
      >
        Add an item
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <textarea 
        autoFocus 
        value={text} 
        onChange={e => setText(e.target.value)} 
        placeholder="Add an item" 
        style={{ 
          width: '100%', 
          padding: '8px 12px', 
          borderRadius: '3px', 
          border: '2px solid #0079bf', 
          outline: 'none', 
          resize: 'none', 
          minHeight: '56px', 
          fontSize: '14px', 
          fontFamily: 'inherit', 
          color: '#172b4d' 
        }} 
      />
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button 
          className="btn-blue" 
          onClick={() => { 
            if (text.trim()) { 
              onAdd(text); 
              setText(""); 
              setIsOpen(false); 
            } 
          }} 
          style={{ padding: '6px 16px', borderRadius: '3px', border: 'none', background: '#0052cc', color: 'white', fontWeight: 500, cursor: 'pointer' }}
        >
          Add
        </button>
        <button 
          onClick={() => { setIsOpen(false); setText(""); }} 
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#42526e', fontWeight: 500, padding: '6px 12px' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
});
export default ChecklistItemInput;
