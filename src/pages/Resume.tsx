import React, { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function Resume() {
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  
  // State to manage the two input types
  const [inputType, setInputType] = useState<'paste' | 'upload'>('paste');
  const [pastedText, setPastedText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      if (!['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'].includes(file.type)) {
        toast.error('Invalid file type. Please upload a PDF, DOCX, or TXT file.');
        setSelectedFile(null);
        e.currentTarget.value = ''; // Clear the input
        return;
      }
      setSelectedFile(file);
      toast.success(`Selected file: ${file.name}`);
    }
  };

  // This is the single function that handles both cases
  const handleAnalyze = async () => {
    setIsLoading(true);
    setQuestions([]);
    
    try {
      let body: FormData | string;
      let headers: Record<string, string> = {};

      // --- Logic for Option 1: Paste (Your existing flow) ---
      if (inputType === 'paste') {
        if (!pastedText.trim()) {
          toast.error('Please paste your resume content.');
          setIsLoading(false);
          return;
        }

        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({ resumeText: pastedText });
      
      // --- Logic for Option 2: Upload (New flow) ---
      } else { // inputType === 'upload'
        if (!selectedFile) {
          toast.error('Please select a file to upload.');
          setIsLoading(false);
          return;
        }
        
        const formData = new FormData();
        formData.append('file', selectedFile);
        body = formData;
        // Note: We DON'T set Content-Type for FormData.
        // The browser adds it automatically with the correct 'boundary'.
      }

      // --- Single API Call to our new function ---
      const { data, error } = await supabase.functions.invoke(
        'generate-questions-from-context', // The new function name
        { 
          body,
          headers 
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      if (!data || !data.questions) {
        throw new Error('Failed to get questions from analysis.');
      }

      setQuestions(data.questions || []);
      toast.success('Generated personalized questions!');

    } catch (err: any) {
      console.error(err);
      toast.error(`Analysis failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper component for tabs
  const TabButton = ({
    label,
    value,
  }: {
    label: string;
    value: 'upload' | 'paste';
  }) => (
    <button
      onClick={() => {
        setInputType(value);
        setQuestions([]); // Clear questions when switching tabs
      }}
      className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors
        ${
          inputType === value
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }
      `}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-100">Generate Questions</h1>
        <p className="text-gray-300 mt-2">
          Paste your resume or upload a file (PDF, DOCX) to get personalized interview questions.
        </p>
      </div>

      <div className="bg-gray-900/60 border border-gray-700 rounded-2xl p-6">
        {/* --- Tab Buttons --- */}
        <div className="flex gap-3 mb-4">
          <TabButton label="Paste Text" value="paste" />
          <TabButton label="Upload File" value="upload" />
        </div>

        {/* --- Conditional Input: Paste --- */}
        {inputType === 'paste' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-100">Paste Resume Content</h2>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              disabled={isLoading}
              rows={15}
              placeholder="Paste your resume content here..."
              className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-400"
            />
          </div>
        )}

        {/* --- Conditional Input: Upload --- */}
        {inputType === 'upload' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-100">Upload Resume File</h2>
            <input
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={handleFileChange}
              disabled={isLoading}
              className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500"
            />
            {selectedFile && (
              <p className="mt-3 text-sm text-gray-300">
                Ready to analyze: <code className="text-indigo-300">{selectedFile.name}</code>
              </p>
            )}
          </div>
        )}
      </div>

      {/* --- Single Analyze Button --- */}
      <div className="bg-gray-900/60 border border-gray-700 rounded-2xl p-6">
        <button
          onClick={handleAnalyze}
          disabled={isLoading}
          className="w-full px-4 py-3 rounded-lg bg-indigo-600 text-white font-semibold disabled:opacity-50 flex items-center justify-center"
        >
          {isLoading ? (
            <Loader2 className="animate-spin h-5 w-5" />
          ) : (
            'Generate Questions'
          )}
        </button>
      </div>

      {/* --- Output Section (Unchanged) --- */}
      {questions.length > 0 && !isLoading && (
        <div className="bg-gray-900/60 border border-gray-700 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">Personalized Questions</h2>
          <ol className="list-decimal ml-6 space-y-2 text-gray-200">
            {questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
