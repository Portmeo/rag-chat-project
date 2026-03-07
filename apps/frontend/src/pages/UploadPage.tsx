import { useState, useEffect, useMemo } from 'react';
import { getDocuments, clearDocuments, deleteDocument, optimizeAllDocuments, optimizeDocument, clearOptimization, clearDocumentOptimization } from '@/services/api';
import FileUpload from '@/components/FileUpload';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Search, Loader2, CheckCircle2, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

interface Document {
  filename: string;
  uploadDate: string;
  alignment_status?: 'optimizing' | 'ready';
  alignment_progress?: number;
  alignment_total?: number;
}

type SortField = 'filename' | 'uploadDate';
type SortDirection = 'asc' | 'desc';

export default function UploadPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [optimizingAll, setOptimizingAll] = useState(false);
  const [optimizingFile, setOptimizingFile] = useState<string | null>(null);
  const [optimizingSet, setOptimizingSet] = useState<Set<string>>(new Set());
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<Document | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('uploadDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const fetchDocuments = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const result = await getDocuments();
      const docs: Document[] = result.documents || [];
      setDocuments(docs);
      return docs;
    } catch (err: any) {
      toast.error('Failed to load documents', {
        description: err.message || 'An error occurred while loading documents',
      });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments().then(docs => {
      if (!docs) return;
      const inProgress = docs.filter(d => d.alignment_status === 'optimizing').map(d => d.filename);
      if (inProgress.length > 0) setOptimizingSet(new Set(inProgress));
    });
  }, []);

  useEffect(() => {
    if (optimizingSet.size === 0) return;
    const interval = setInterval(async () => {
      await fetchDocuments(true);
      setOptimizingSet(prev => {
        const next = new Set(prev);
        documents.forEach(d => { if (d.alignment_status === 'ready') next.delete(d.filename); });
        return next;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [optimizingSet, documents]);


  const handleFileUploaded = () => {
    fetchDocuments();
  };

  const handleDeleteDocument = async () => {
    if (!fileToDelete) return;

    try {
      setDeletingFile(fileToDelete.filename);
      await deleteDocument(fileToDelete.filename);
      await fetchDocuments();
      setShowDeleteDialog(false);
      setFileToDelete(null);
      toast.success('Document deleted', {
        description: `${fileToDelete.filename} has been removed`,
      });
    } catch (err: any) {
      toast.error('Failed to delete document', {
        description: err.message || 'An error occurred while deleting the document',
      });
    } finally {
      setDeletingFile(null);
    }
  };

  const handleOptimizeAll = async () => {
    try {
      setOptimizingAll(true);
      await optimizeAllDocuments();
      setOptimizingSet(new Set(documents.map(d => d.filename)));
      await fetchDocuments(true);
      toast.success('Optimization started', { description: 'Generating alignment questions in background' });
    } catch (err: any) {
      toast.error('Failed to start optimization', { description: err.message });
    } finally {
      setOptimizingAll(false);
    }
  };

  const handleOptimizeOne = async (filename: string) => {
    try {
      setOptimizingFile(filename);
      await optimizeDocument(filename);
      setOptimizingSet(prev => new Set(prev).add(filename));
      await fetchDocuments(true);
    } catch (err: any) {
      toast.error('Failed to start optimization', { description: err.message });
    } finally {
      setOptimizingFile(null);
    }
  };

  const handleClearOptimization = async () => {
    try {
      await clearOptimization();
      await fetchDocuments(true);
      toast.success('Optimization cleared');
    } catch (err: any) {
      toast.error('Failed to clear optimization', { description: err.message });
    }
  };

  const handleClearOptimizationOne = async (filename: string) => {
    try {
      await clearDocumentOptimization(filename);
      await fetchDocuments(true);
    } catch (err: any) {
      toast.error('Failed to clear optimization', { description: err.message });
    }
  };

  const handleClearAll = async () => {
    try {
      setClearing(true);
      await clearDocuments();
      fetchDocuments();
      setShowClearDialog(false);
      toast.success('All documents cleared', {
        description: 'All documents have been removed from the knowledge base',
      });
    } catch (err: any) {
      toast.error('Failed to clear documents', {
        description: err.message || 'An error occurred while clearing documents',
      });
    } finally {
      setClearing(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedDocuments = useMemo(() => {
    let filtered = documents;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = documents.filter((doc) =>
        doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort documents
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      if (sortField === 'filename') {
        comparison = a.filename.localeCompare(b.filename);
      } else if (sortField === 'uploadDate') {
        comparison = new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime();
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [documents, searchQuery, sortField, sortDirection]);

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

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    );
  };

  return (
    <div className="flex flex-col h-full p-8">
      <Card>
        <CardHeader>
          <CardTitle>Upload Documents</CardTitle>
          <CardDescription>
            Upload HTML or Markdown files to create your knowledge base
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FileUpload onFileUploaded={handleFileUploaded} />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Uploaded Documents ({searchQuery ? `${filteredAndSortedDocuments.length} / ${documents.length}` : documents.length})
              </h3>
              {documents.length > 0 && (
                <div className="flex gap-2">
                  {documents.some(d => d.alignment_status) && (
                    <Button variant="outline" size="sm" onClick={handleClearOptimization}>
                      <X className="h-4 w-4 mr-2" />
                      Clear Optimization
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleOptimizeAll} disabled={optimizingAll}>
                    {optimizingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Optimize All
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setShowClearDialog(true)} disabled={clearing}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                </div>
              )}
            </div>

            {documents.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}

            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : documents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No documents uploaded yet. Upload HTML or Markdown files to get started.
              </p>
            ) : filteredAndSortedDocuments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No documents found matching "{searchQuery}"
              </p>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button
                          onClick={() => handleSort('filename')}
                          className="flex items-center hover:text-foreground transition-colors"
                        >
                          Document
                          {getSortIcon('filename')}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort('uploadDate')}
                          className="flex items-center hover:text-foreground transition-colors"
                        >
                          Upload Date
                          {getSortIcon('uploadDate')}
                        </button>
                      </TableHead>
                      <TableHead className="w-[160px]">Optimization</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedDocuments.map((doc, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <a
                            href={`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/documents/${encodeURIComponent(doc.filename)}`}
                            download={doc.filename}
                            className="flex items-center gap-2 text-primary hover:underline"
                          >
                            <FileText className="h-4 w-4" />
                            {doc.filename}
                          </a>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(doc.uploadDate)}
                        </TableCell>
                        <TableCell>
                          {doc.alignment_status === 'optimizing' && (
                            <span className="flex items-center gap-1.5 text-xs text-amber-600">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              {doc.alignment_progress}/{doc.alignment_total}
                            </span>
                          )}
                          {doc.alignment_status === 'ready' && (
                            <span className="flex items-center gap-2">
                              <span className="flex items-center gap-1.5 text-xs text-green-600">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Listo ({doc.alignment_total})
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => handleClearOptimizationOne(doc.filename)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </span>
                          )}
                          {!doc.alignment_status && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleOptimizeOne(doc.filename)}
                              disabled={optimizingFile === doc.filename}
                            >
                              {optimizingFile === doc.filename
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Sparkles className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setFileToDelete(doc);
                              setShowDeleteDialog(true);
                            }}
                            disabled={deletingFile === doc.filename}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            {deletingFile === doc.filename && (
                              <span className="ml-2">Deleting...</span>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{fileToDelete?.filename}"? This will remove all chunks from the vector store.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setFileToDelete(null);
              }}
              disabled={deletingFile !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteDocument}
              disabled={deletingFile !== null}
            >
              {deletingFile ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Documents</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all documents? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClearDialog(false)}
              disabled={clearing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearAll}
              disabled={clearing}
            >
              {clearing ? 'Clearing...' : 'Clear All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
