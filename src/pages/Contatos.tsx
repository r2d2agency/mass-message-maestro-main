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
import { Upload, Plus, Search, Users, FileSpreadsheet, Trash2, Eye } from "lucide-react";
import { api } from "@/lib/api";
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
  list_name: string;
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

    file.text().then((text) => {
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
    });
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
      if (!newListName.trim()) {
        toast({
          title: "Informe o nome da lista",
          variant: "destructive",
        });
        return;
      }

      if (!uploadFile) {
        toast({
          title: "Selecione um arquivo para importação",
          variant: "destructive",
        });
        return;
      }

      const extension = uploadFile.name.toLowerCase().split(".").pop();

      if (extension !== "csv") {
        toast({
          title: "Formato de arquivo não suportado",
          description: "No momento, importe apenas arquivos CSV.",
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

      const text = await uploadFile.text();
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

      const createdList = await api<ApiContactList>("/api/contacts/lists", {
        method: "POST",
        body: { name: newListName.trim() },
      });

      const importResponse = await api<ImportResult>(
        `/api/contacts/lists/${createdList.id}/import`,
        {
          method: "POST",
          body: { contacts: contactsToImport },
        }
      );

      setImportResult(importResponse);

      setLists((prev) => [
        {
          id: createdList.id,
          name: createdList.name,
          contactCount: importResponse.imported,
          createdAt: new Date(createdList.created_at).toLocaleDateString(
            "pt-BR"
          ),
        },
        ...prev,
      ]);

      if (importResponse.imported > 0) {
        const refreshedContacts = await api<ApiContact[]>(
          `/api/contacts/lists/${createdList.id}/contacts`
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
        description: `Total no arquivo: ${importResponse.total} | Com WhatsApp: ${importResponse.totalWhatsapp} | Importados: ${importResponse.imported} | Com erros: ${importResponse.totalErrors}`,
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

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between animate-slide-up">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Contatos</h1>
            <p className="mt-1 text-muted-foreground">
              Gerencie suas listas de contatos
            </p>
          </div>
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient">
                <Upload className="h-4 w-4" />
                Importar Lista
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Importar Lista de Contatos</DialogTitle>
                <DialogDescription>
                  Faça upload de uma planilha com os contatos (CSV ou Excel)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="listName">Nome da Lista</Label>
                  <Input
                    id="listName"
                    placeholder="Nome da lista"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                  />
                </div>
              <div className="space-y-2">
                <Label>Arquivo</Label>
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary">
                  <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                      Arraste seu arquivo ou clique para selecionar
                    </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Suporta CSV, XLS, XLSX
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
                  <strong>Formato esperado:</strong> A planilha deve ter as colunas
                  "nome" e "telefone" (com código do país).
                </p>
              </div>
              {columnPreviews.length > 0 && (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-foreground">
                    Mapeie as colunas da planilha para os campos internos do sistema.
                    É obrigatório informar qual coluna é Nome e qual é Telefone.
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
                              <p key={idx}>
                                {sample || "(vazio)"}
                              </p>
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
                <div className="rounded-lg bg-muted p-3 text-xs text-foreground space-y-1">
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
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
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

        {/* Lists Grid */}
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

        {/* Contacts Table */}
        <Card className="animate-fade-in shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
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
              <div className="relative w-64">
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
            <Table>
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
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Contatos;
