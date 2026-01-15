import { useEffect, useState, type ChangeEvent } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Plus, Search, Users, FileSpreadsheet, Trash2, Eye, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";

interface ContactList {
  id: string;
  name: string;
  contactCount: number;
  createdAt: string;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  listId: string;
}

interface ApiContactList {
  id: string;
  name: string;
  contact_count: number;
  created_at: string;
}

interface ApiContact {
  id: string;
  name: string;
  phone: string;
  list_id: string;
}

interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  totalWhatsapp: number;
  totalErrors: number;
}

interface CsvColumnPreview {
  index: number;
  header: string;
  samples: string[];
}

type MappedField = "none" | "name" | "phone";

interface ApiCreatedContact {
  id: string;
  name: string;
  phone: string;
  list_id: string;
}

const Contatos = () => {
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [lists, setLists] = useState<ContactList[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [columnPreviews, setColumnPreviews] = useState<CsvColumnPreview[]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<number, MappedField>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [importTargetMode, setImportTargetMode] = useState<"new" | "existing">("new");
  const [importTargetListId, setImportTargetListId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [listsData, contactsData] = await Promise.all([
          api<ApiContactList[]>("/api/contacts/lists"),
          api<ApiContact[]>("/api/contacts"),
        ]);

        setLists(
          listsData.map((list) => ({
            id: list.id,
            name: list.name,
            contactCount: Number(list.contact_count) || 0,
            createdAt: new Date(list.created_at).toLocaleDateString("pt-BR"),
          }))
        );

        setContacts(
          contactsData.map((contact) => ({
            id: contact.id,
            name: contact.name,
            phone: contact.phone,
            listId: contact.list_id,
          }))
        );
      } catch (error) {
        toast({
          title: "Erro ao carregar contatos",
          description:
            error instanceof Error ? error.message : "Tente novamente mais tarde",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [toast]);

  const handleDeleteContact = async (id: string) => {
    try {
      await api(`/api/contacts/${id}`, { method: "DELETE" });
      setContacts((prev) => prev.filter((contact) => contact.id !== id));
      toast({ title: "Contato removido com sucesso" });
    } catch (error) {
      toast({
        title: "Erro ao remover contato",
        description:
          error instanceof Error ? error.message : "Tente novamente mais tarde",
        variant: "destructive",
      });
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;

    if (!file) {
      setUploadFile(null);
      setColumnPreviews([]);
      setColumnMappings({});
      setImportResult(null);
      return;
    }

    setUploadFile(file);
    setImportResult(null);

    const extension = file.name.toLowerCase().split(".").pop();

    const processText = (text: string) => {
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length === 0) {
        setColumnPreviews([]);
        setColumnMappings({});
        return;
      }

      const headerLine = lines[0];
      const dataLines = lines.slice(1);

      const separator = headerLine.includes(";")
        ? ";"
        : headerLine.includes(",")
        ? ","
        : ";";

      const headers = headerLine
        .split(separator)
        .map((h, index) => h.trim() || `Coluna ${index + 1}`);

      const previews: CsvColumnPreview[] = headers.map((header, index) => {
        const samples: string[] = [];
        const sampleCount = Math.min(3, dataLines.length);

        for (let i = 0; i < sampleCount; i += 1) {
          const parts = dataLines[i].split(separator);
          samples.push((parts[index] || "").trim());
        }

        return { index, header, samples };
      });

      const initialMappings: Record<number, MappedField> = {};

      previews.forEach((col) => {
        const headerLower = col.header.toLowerCase();

        if (headerLower.includes("nome") || headerLower.includes("name")) {
          initialMappings[col.index] = "name";
        } else if (
          headerLower.includes("telefone") ||
          headerLower.includes("phone") ||
          headerLower.includes("celular") ||
          headerLower.includes("whats")
        ) {
          initialMappings[col.index] = "phone";
        } else {
          initialMappings[col.index] = "none";
        }
      });

      setColumnPreviews(previews);
      setColumnMappings(initialMappings);
    };

    if (extension === "xls" || extension === "xlsx") {
      file.arrayBuffer().then((buffer) => {
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        processText(csv);
      });
    } else {
      file.text().then((text) => {
        processText(text);
      });
    }
  };

  const handleMappingChange = (index: number, field: MappedField) => {
    setColumnMappings((prev) => {
      const next: Record<number, MappedField> = { ...prev };

      if (field === "name" || field === "phone") {
        Object.entries(next).forEach(([key, value]) => {
          const colIndex = Number(key);
          if (colIndex !== index && value === field) {
            next[colIndex] = "none";
          }
        });
      }

      next[index] = field;
      return next;
    });
  };

  const handleImport = async () => {
    try {
      if (!uploadFile) {
        toast({
          title: "Selecione um arquivo para importação",
          variant: "destructive",
        });
        return;
      }

      setIsImporting(true);

      if (columnPreviews.length === 0) {
        toast({
          title: "Nenhuma coluna detectada",
          description:
            "Selecione um arquivo válido para visualizar e mapear as colunas.",
          variant: "destructive",
        });
        return;
      }

      const nameColumns = Object.entries(columnMappings)
        .filter(([, field]) => field === "name")
        .map(([index]) => Number(index));

      const phoneColumns = Object.entries(columnMappings)
        .filter(([, field]) => field === "phone")
        .map(([index]) => Number(index));

      if (nameColumns.length !== 1 || phoneColumns.length !== 1) {
        toast({
          title: "Mapeamento obrigatório",
          description:
            "Informe exatamente uma coluna para Nome e uma coluna para Telefone.",
          variant: "destructive",
        });
        return;
      }

      const nameIndex = nameColumns[0];
      const phoneIndex = phoneColumns[0];

      const extension = uploadFile.name.toLowerCase().split(".").pop();

      let text = "";

      if (extension === "xls" || extension === "xlsx") {
        const buffer = await uploadFile.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        text = XLSX.utils.sheet_to_csv(worksheet);
      } else {
        text = await uploadFile.text();
      }

      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length <= 1) {
        toast({
          title: "Arquivo vazio",
          description: "Nenhum dado encontrado após o cabeçalho.",
          variant: "destructive",
        });
        return;
      }

      const headerLine = lines[0];
      const dataLines = lines.slice(1);

      const separator = headerLine.includes(";")
        ? ";"
        : headerLine.includes(",")
        ? ","
        : ";";

      const contactsToImport: { name: string; phone: string }[] = [];

      for (const line of dataLines) {
        const parts = line.split(separator);

        const name = (parts[nameIndex] || "").trim();
        const phone = (parts[phoneIndex] || "").trim();

        if (!name && !phone) {
          continue;
        }

        contactsToImport.push({ name, phone });
      }

      if (contactsToImport.length === 0) {
        toast({
          title: "Nenhum contato encontrado",
          description:
            "Verifique se o arquivo contém as colunas nome e telefone.",
          variant: "destructive",
        });
        return;
      }
      if (importTargetMode === "new" && !newListName.trim()) {
        toast({
          title: "Informe o nome da lista",
          variant: "destructive",
        });
        return;
      }
      if (importTargetMode === "existing" && !importTargetListId) {
        toast({
          title: "Selecione uma lista de destino",
          variant: "destructive",
        });
        return;
      }

      let targetListId = importTargetListId;
      let createdList: ApiContactList | null = null;

      if (importTargetMode === "new") {
        createdList = await api<ApiContactList>("/api/contacts/lists", {
          method: "POST",
          body: { name: newListName.trim() },
        });
        targetListId = createdList.id;
      }

      // Process in chunks of 10 to avoid timeout/payload issues
      const CHUNK_SIZE = 10;
      const totalContacts = contactsToImport.length;
      
      const accumulatedResult: ImportResult = {
        success: true,
        total: 0,
        imported: 0,
        totalWhatsapp: 0,
        totalErrors: 0
      };

      for (let i = 0; i < totalContacts; i += CHUNK_SIZE) {
        const chunk = contactsToImport.slice(i, i + CHUNK_SIZE);
        
        try {
          const chunkResponse = await api<ImportResult>(
            `/api/contacts/lists/${targetListId}/import`,
            {
              method: "POST",
              body: { contacts: chunk },
            }
          );

          accumulatedResult.total += chunkResponse.total;
          accumulatedResult.imported += chunkResponse.imported;
          accumulatedResult.totalWhatsapp += chunkResponse.totalWhatsapp;
          accumulatedResult.totalErrors += chunkResponse.totalErrors;
        } catch (err) {
          console.error(`Error importing chunk ${i}:`, err);
          accumulatedResult.totalErrors += chunk.length;
          // Continue to next chunk even if one fails
        }
      }

      setImportResult(accumulatedResult);

      if (importTargetMode === "new" && createdList) {
        setLists((prev) => [
          {
            id: createdList.id,
            name: createdList.name,
            contactCount: accumulatedResult.imported,
            createdAt: new Date(createdList.created_at).toLocaleDateString(
              "pt-BR"
            ),
          },
          ...prev,
        ]);
      } else if (targetListId) {
        setLists((prev) =>
          prev.map((list) =>
            list.id === targetListId
              ? { ...list, contactCount: list.contactCount + accumulatedResult.imported }
              : list
          )
        );
      }

      if (accumulatedResult.imported > 0) {
        const refreshedContacts = await api<ApiContact[]>(
          `/api/contacts/lists/${targetListId}/contacts`
        );

        setContacts((prev) => [
          ...prev,
          ...refreshedContacts.map((contact) => ({
            id: contact.id,
            name: contact.name,
            phone: contact.phone,
            listId: contact.list_id,
          })),
        ]);
      }

      toast({
        title: "Importação concluída",
        description: `Total no arquivo: ${accumulatedResult.total} | Com WhatsApp: ${accumulatedResult.totalWhatsapp} | Importados: ${accumulatedResult.imported} | Com erros: ${accumulatedResult.totalErrors}`,
      });
    } catch (error) {
      toast({
        title: "Erro ao importar contatos",
        description:
          error instanceof Error ? error.message : "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const filteredContacts = contacts.filter(
    (contact) =>
      (!selectedList || contact.listId === selectedList) &&
      (contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.phone.includes(searchTerm))
  );

  const handleCreateContact = async () => {
    try {
      if (!selectedList) {
        toast({
          title: "Selecione uma lista para adicionar o contato",
          variant: "destructive",
        });
        return;
      }

      if (!newContactName.trim() || !newContactPhone.trim()) {
        toast({
          title: "Nome e telefone são obrigatórios",
          variant: "destructive",
        });
        return;
      }

      setIsCreating(true);

      const created = await api<ApiCreatedContact>(
        `/api/contacts/lists/${selectedList}/contacts`,
        {
          method: "POST",
          body: {
            name: newContactName.trim(),
            phone: newContactPhone.trim(),
          },
        }
      );

      setContacts((prev) => [
        ...prev,
        {
          id: created.id,
          name: created.name,
          phone: created.phone,
          listId: created.list_id,
        },
      ]);

      setLists((prev) =>
        prev.map((list) =>
          list.id === selectedList
            ? { ...list, contactCount: list.contactCount + 1 }
            : list
        )
      );

      setNewContactName("");
      setNewContactPhone("");
      setIsCreateOpen(false);

      toast({
        title: "Contato criado com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro ao criar contato",
        description:
          error instanceof Error ? error.message : "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between animate-slide-up">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Contatos</h1>
            <p className="mt-1 text-muted-foreground">
              Gerencie suas listas de contatos
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedList && (
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="h-4 w-4" />
                    Novo Contato
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Novo Contato</DialogTitle>
                    <DialogDescription>
                      Adicione um contato manualmente à lista selecionada.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="contactName">Nome</Label>
                      <Input
                        id="contactName"
                        placeholder="Nome do contato"
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactPhone">Telefone (com DDD e país)</Label>
                      <Input
                        id="contactPhone"
                        placeholder="5511999999999"
                        value={newContactPhone}
                        onChange={(e) => setNewContactPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateOpen(false)}
                      disabled={isCreating}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="gradient"
                      onClick={handleCreateContact}
                      disabled={isCreating}
                    >
                      {isCreating && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Salvar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
              <DialogTrigger asChild>
                <Button variant="gradient">
                  <Upload className="h-4 w-4" />
                  Importar Lista
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Importar Lista de Contatos</DialogTitle>
                  <DialogDescription>
                    Faça upload de uma arquivo CSV com os contatos
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 overflow-y-auto pr-2 flex-1">
                  <div className="space-y-2">
                    <Label>Lista de destino</Label>
                    <Select
                      value={
                        importTargetMode === "new"
                          ? "new"
                          : importTargetListId || "new"
                      }
                      onValueChange={(value) => {
                        if (value === "new") {
                          setImportTargetMode("new");
                          setImportTargetListId(null);
                        } else {
                          setImportTargetMode("existing");
                          setImportTargetListId(value);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione ou crie uma lista" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Criar nova lista</SelectItem>
                        {lists.map((list) => (
                          <SelectItem key={list.id} value={list.id}>
                            {list.name} ({list.contactCount} contatos)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {importTargetMode === "new" && (
                    <div className="space-y-2">
                      <Label htmlFor="listName">Nome da Lista</Label>
                      <Input
                        id="listName"
                        placeholder="Nome da lista"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Arquivo</Label>
                    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary">
                      <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Arraste seu arquivo ou clique para selecionar
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Suporta CSV, XLS e XLSX
                      </p>
                      <Input
                        type="file"
                        accept=".csv,.xls,.xlsx"
                        onChange={handleFileChange}
                        className="mt-4"
                      />
                    </div>
                  </div>
                  <div className="rounded-lg bg-accent/50 p-3">
                    <p className="text-xs text-muted-foreground">
                      <strong>Formato esperado:</strong> A planilha deve ter as
                      colunas "nome" e "telefone" (com código do país).
                    </p>
                  </div>
                  {columnPreviews.length > 0 && (
                    <div className="space-y-3 rounded-lg border border-border p-3">
                      <p className="text-xs font-medium text-foreground">
                        Mapeie as colunas da planilha para os campos internos do
                        sistema. É obrigatório informar qual coluna é Nome e qual é
                        Telefone.
                      </p>
                      <div className="space-y-2">
                        {columnPreviews.map((col) => (
                          <div
                            key={col.index}
                            className="flex items-start gap-4 rounded-md bg-accent/40 p-2"
                          >
                            <div className="flex-1 text-xs">
                              <p className="font-semibold text-foreground">
                                Coluna {col.index + 1}: {col.header}
                              </p>
                              <div className="mt-1 text-muted-foreground">
                                {col.samples.map((sample, idx) => (
                                  <p key={idx}>{sample || "(vazio)"}</p>
                                ))}
                              </div>
                            </div>
                            <div className="w-40 space-y-1">
                              <Label className="text-xs">Campo no sistema</Label>
                              <Select
                                value={columnMappings[col.index] ?? "none"}
                                onValueChange={(value) =>
                                  handleMappingChange(
                                    col.index,
                                    value as MappedField
                                  )
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Selecionar campo" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Ignorar</SelectItem>
                                  <SelectItem value="name">Nome</SelectItem>
                                  <SelectItem value="phone">Telefone</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {importResult && (
                    <div className="space-y-1 rounded-lg bg-muted p-3 text-xs text-foreground">
                      <p>
                        <strong>Total no arquivo:</strong> {importResult.total}
                      </p>
                      <p>
                        <strong>Total com WhatsApp:</strong>{" "}
                        {importResult.totalWhatsapp}
                      </p>
                      <p>
                        <strong>Importados:</strong> {importResult.imported}
                      </p>
                      <p>
                        <strong>Total com erros:</strong> {importResult.totalErrors}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t border-border mt-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsUploadOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="gradient"
                    onClick={handleImport}
                    disabled={isImporting}
                  >
                    <Upload className="h-4 w-4" />
                    {isImporting ? "Importando..." : "Importar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card
            className={`cursor-pointer transition-all duration-200 hover:shadow-elevated animate-fade-in ${
              selectedList === null ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => setSelectedList(null)}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Todos os Contatos</p>
                <p className="text-sm text-muted-foreground">
                  {contacts.length} contatos
                </p>
              </div>
            </CardContent>
          </Card>
          {lists.map((list, index) => (
            <Card
              key={list.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-elevated animate-fade-in ${
                selectedList === list.id ? "ring-2 ring-primary" : ""
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => setSelectedList(list.id)}
            >
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                    <FileSpreadsheet className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{list.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {list.contactCount} contatos
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">{list.createdAt}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="animate-fade-in shadow-card">
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>
                  {selectedList
                    ? lists.find((l) => l.id === selectedList)?.name
                    : "Todos os Contatos"}
                </CardTitle>
                <CardDescription>
                  {filteredContacts.length} contatos encontrados
                </CardDescription>
              </div>
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar contatos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Lista</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">{contact.name}</TableCell>
                      <TableCell>{contact.phone}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {lists.find((l) => l.id === contact.listId)?.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteContact(contact.id)}
                            disabled={isLoading}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Contatos;
