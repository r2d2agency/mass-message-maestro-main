import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Users, Plus, Shield, Mail, User as UserIcon, Lock, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  status: "active" | "inactive" | "blocked";
  plan_name: string | null;
  monthly_message_limit: number | null;
  created_at: string;
  updated_at: string;
  role: "admin" | "manager" | "user";
}

const Usuarios = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "user">("user");
  const [planName, setPlanName] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setIsLoading(true);
        const data = await api<AdminUser[]>("/api/users");
        setUsers(data);
      } catch (error) {
        toast({
          title: "Erro ao carregar usuários",
          description:
            error instanceof Error ? error.message : "Tente novamente mais tarde",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadUsers();
  }, [toast]);

  const handleCreateUser = async () => {
    try {
      if (!email.trim() || !name.trim() || !password.trim()) {
        toast({
          title: "Preencha nome, email e senha",
          variant: "destructive",
        });
        return;
      }

      setIsCreating(true);

      const created = await api<AdminUser>("/api/users", {
        method: "POST",
        body: {
          email: email.trim(),
          password: password.trim(),
          name: name.trim(),
          role,
          plan_name: planName.trim() || undefined,
          monthly_message_limit: monthlyLimit ? Number(monthlyLimit) : undefined,
        },
      });

      setUsers((prev) => [created, ...prev]);

      setName("");
      setEmail("");
      setPassword("");
      setPlanName("");
      setMonthlyLimit("");
      setRole("user");
      setIsCreateOpen(false);

      toast({
        title: "Usuário criado com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro ao criar usuário",
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
        <div className="flex items-center justify-between animate-slide-up">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Gestão de Usuários
            </h1>
            <p className="mt-1 text-muted-foreground">
              Controle os usuários que podem acessar o Blaster
            </p>
          </div>
          {user?.role === "admin" && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button variant="gradient">
                  <Plus className="h-4 w-4" />
                  Novo Usuário
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Novo Usuário</DialogTitle>
                  <DialogDescription>
                    Crie um novo usuário com permissões e limites definidos.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="userName">Nome</Label>
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="userName"
                        placeholder="Nome completo"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userEmail">Email</Label>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="userEmail"
                        type="email"
                        placeholder="usuario@empresa.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userPassword">Senha inicial</Label>
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="userPassword"
                        type="password"
                        placeholder="Senha temporária"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Papel</Label>
                    <Select
                      value={role}
                      onValueChange={(value) =>
                        setRole(value as "admin" | "manager" | "user")
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o papel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Usuário</SelectItem>
                        <SelectItem value="manager">Gerente</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="planName">Plano</Label>
                      <Input
                        id="planName"
                        placeholder="Ex: Pro, Basic"
                        value={planName}
                        onChange={(e) => setPlanName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="monthlyLimit">Limite mensal</Label>
                      <Input
                        id="monthlyLimit"
                        type="number"
                        placeholder="Ex: 10000"
                        value={monthlyLimit}
                        onChange={(e) => setMonthlyLimit(e.target.value)}
                      />
                    </div>
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
                    onClick={handleCreateUser}
                    disabled={isCreating}
                  >
                    {isCreating && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Criar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card className="animate-fade-in shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Usuários do Sistema
                </CardTitle>
                <CardDescription>
                  {isLoading
                    ? "Carregando usuários..."
                    : `${users.length} usuário(s) cadastrados`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {u.role === "admin"
                          ? "Admin"
                          : u.role === "manager"
                          ? "Gerente"
                          : "Usuário"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          u.status === "active"
                            ? "default"
                            : u.status === "blocked"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {u.status === "active"
                          ? "Ativo"
                          : u.status === "blocked"
                          ? "Bloqueado"
                          : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.plan_name ? (
                        <span>
                          {u.plan_name}
                          {u.monthly_message_limit
                            ? ` (${u.monthly_message_limit} msgs/mês)`
                            : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Sem plano</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      Nenhum usuário cadastrado ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Usuarios;
