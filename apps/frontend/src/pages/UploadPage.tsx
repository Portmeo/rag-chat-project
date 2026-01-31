import { useState, useEffect } from 'react';
import { getDocuments, clearDocuments } from '../services/api';
import FileUpload from '../components/FileUpload';

interface Document {
  filename: string;
  uploadDate: string;
}

export default function UploadPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const result = await getDocuments();
      setDocuments(result.documents || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileUploaded = () => {
    fetchDocuments();
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to delete all documents? This action cannot be undone.')) {
      return;
    }

    try {
      setClearing(true);
      await clearDocuments();
      fetchDocuments();
    } catch (err: any) {
      setError(err.message || 'Failed to clear documents');
    } finally {
      setClearing(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="upload-page">
      <div className="upload-container">
        <h2>Upload Documents</h2>

        <FileUpload onFileUploaded={handleFileUploaded} />

        <div className="documents-table">
          <div className="documents-header">
            <h3>Uploaded Documents ({documents.length})</h3>
            {documents.length > 0 && (
              <button
                onClick={handleClearAll}
                disabled={clearing}
                className="clear-all-button"
              >
                {clearing ? 'Clearing...' : 'Clear All'}
              </button>
            )}
          </div>

          {error && <p className="error">{error}</p>}

          {loading ? (
            <p className="loading">Loading documents...</p>
          ) : documents.length === 0 ? (
            <p className="no-documents">No documents uploaded yet. Upload HTML or Markdown files to get started.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Upload Date</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc, idx) => (
                  <tr key={idx}>
                    <td>
                      <span className="file-icon">📄</span>
                      <a
                        href={`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/documents/${encodeURIComponent(doc.filename)}`}
                        download={doc.filename}
                        className="document-link"
                      >
                        {doc.filename}
                      </a>
                    </td>
                    <td>{formatDate(doc.uploadDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
