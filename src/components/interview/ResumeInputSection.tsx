import React from 'react';
import { Button } from '@/components/ui/button';

interface ResumeInputSectionProps {
  resumeInputMethod: 'upload' | 'text';
  setResumeInputMethod: (method: 'upload' | 'text') => void;
  resumeUploaded: boolean;
  resumeFile: File | null;
  isUploadingResume: boolean;
  handleResumeUpload: (file: File) => void;
  handleResumeDelete?: () => void;
  resumeText: string;
  setResumeText: (text: string) => void;
  showToast: (msg: string, type?: string) => void;
  setResumeUploaded: (v: boolean) => void;
}

const ResumeInputSection: React.FC<ResumeInputSectionProps> = ({
  resumeInputMethod,
  setResumeInputMethod,
  resumeUploaded,
  resumeFile,
  isUploadingResume,
  handleResumeUpload,
  handleResumeDelete,
  resumeText,
  setResumeText,
  showToast,
  setResumeUploaded
}) => {
  return (
    <div className="bg-gray-800/50 rounded-xl p-6 mb-6 border border-gray-700">
      <h2 className="text-xl font-semibold text-white mb-4">Provide Your Resume</h2>
      <p className="text-gray-300 text-sm mb-4">
        We'll analyze your resume to generate personalized interview questions tailored to your experience.
      </p>
      <div className="flex space-x-1 mb-6 bg-gray-700/50 rounded-lg p-1">
        <button
          onClick={() => setResumeInputMethod('upload')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            resumeInputMethod === 'upload'
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
          }`}
        >
          Upload PDF
        </button>
        <button
          onClick={() => setResumeInputMethod('text')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            resumeInputMethod === 'text'
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
          }`}
        >
          Paste Text
        </button>
      </div>
      {!resumeUploaded ? (
        <div className="space-y-4">
          {resumeInputMethod === 'upload' ? (
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
              <input
                type="file"
                id="resume-upload"
                accept=".pdf,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleResumeUpload(file);
                  }
                }}
                className="hidden"
              />
              <label htmlFor="resume-upload" className="cursor-pointer">
                <svg className="h-12 w-12 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-white font-medium mb-1">
                  {isUploadingResume ? 'Uploading...' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-gray-400 text-sm">PDF, DOC, or DOCX (Max 10MB)</p>
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste your resume content here..."
                className="w-full h-64 p-4 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    if (resumeText.trim().length > 50) {
                      setResumeUploaded(true);
                      showToast('Resume content saved!', 'success');
                    } else {
                      showToast('Please enter at least 50 characters of resume content', 'error');
                    }
                  }}
                  disabled={resumeText.trim().length < 50}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Save Resume Content
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-blue-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-gray-300 text-sm">
                {resumeInputMethod === 'upload' ? resumeFile?.name : 'Resume text content'}
              </span>
            </div>
            {handleResumeDelete && (
              <Button
                onClick={handleResumeDelete}
                disabled={isUploadingResume}
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </Button>
            )}
          </div>
          <div className="text-center space-y-2">
            <p className="text-gray-400 text-sm">We're ready to generate your personalized questions.</p>
            {handleResumeDelete && (
              <Button
                onClick={handleResumeDelete}
                disabled={isUploadingResume}
                variant="outline"
                size="sm"
                className="text-red-400 border-red-700 hover:bg-red-900/20 hover:border-red-600"
              >
                Remove Resume
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumeInputSection;
