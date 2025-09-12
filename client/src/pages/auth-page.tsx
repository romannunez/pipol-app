import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import LoadingSpinner from "../components/ui/loading-spinner";

// Login form schema
const loginSchema = z.object({
  email: z.string().email("Ingresa un correo electrónico válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

// Register form schema
const registerSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  username: z.string().min(3, "El nombre de usuario debe tener al menos 3 caracteres"),
  email: z.string().email("Ingresa un correo electrónico válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("login");
  const [_, navigate] = useLocation();
  const { toast } = useToast();

  // Redirect if already logged in
  useEffect(() => {
    if (user && !isLoading) {
      navigate("/");
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md">
          <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="register">Crear Cuenta</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <Card>
                <CardHeader className="space-y-1">
                  <div className="flex justify-center mb-4">
                    <img src="/logo.svg" alt="Pipol Logo" className="h-12" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-center">Iniciar Sesión</CardTitle>
                  <CardDescription className="text-center">
                    Ingresa tus credenciales para acceder a tu cuenta
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LoginForm />
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                  <div className="text-sm text-center text-muted-foreground">
                    ¿No tienes una cuenta?{" "}
                    <Button
                      variant="link"
                      className="p-0 h-auto"
                      onClick={() => setActiveTab("register")}
                    >
                      Regístrate ahora
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </TabsContent>
            <TabsContent value="register">
              <Card>
                <CardHeader className="space-y-1">
                  <div className="flex justify-center mb-4">
                    <img src="/logo.svg" alt="Pipol Logo" className="h-12" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-center">Crear Cuenta</CardTitle>
                  <CardDescription className="text-center">
                    Regístrate para comenzar a crear y unirte a eventos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RegisterForm />
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                  <div className="text-sm text-center text-muted-foreground">
                    ¿Ya tienes una cuenta?{" "}
                    <Button
                      variant="link"
                      className="p-0 h-auto"
                      onClick={() => setActiveTab("login")}
                    >
                      Inicia sesión
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Hero Section */}
      <div className="flex-1 bg-gradient-to-br from-secondary to-secondary-foreground p-8 text-white hidden md:flex flex-col justify-center">
        <div className="max-w-md mx-auto">
          <div className="flex justify-center mb-8">
            <img src="/logo.svg" alt="Pipol Logo" className="h-24" />
          </div>
          <h1 className="text-4xl font-bold mb-4 text-primary">
            Únete a la comunidad de eventos
          </h1>
          <p className="text-lg mb-8">
            Descubre eventos cercanos, crea los tuyos propios y conecta con personas
            que comparten tus intereses.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-primary/20 backdrop-blur-sm p-4 rounded-lg">
              <h3 className="font-semibold mb-2 text-primary">Crea Eventos</h3>
              <p className="text-sm">
                Organiza desde pequeñas reuniones hasta grandes celebraciones
              </p>
            </div>
            <div className="bg-primary/20 backdrop-blur-sm p-4 rounded-lg">
              <h3 className="font-semibold mb-2 text-primary">Descubre</h3>
              <p className="text-sm">
                Encuentra eventos cercanos que coincidan con tus intereses
              </p>
            </div>
            <div className="bg-primary/20 backdrop-blur-sm p-4 rounded-lg">
              <h3 className="font-semibold mb-2 text-primary">Conecta</h3>
              <p className="text-sm">
                Conoce personas con intereses similares a los tuyos
              </p>
            </div>
            <div className="bg-primary/20 backdrop-blur-sm p-4 rounded-lg">
              <h3 className="font-semibold mb-2 text-primary">Comparte</h3>
              <p className="text-sm">
                Comparte experiencias y momentos especiales con los demás
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const { loginMutation } = useAuth();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Correo Electrónico</FormLabel>
              <FormControl>
                <Input
                  placeholder="tu@email.com"
                  type="email"
                  autoComplete="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contraseña</FormLabel>
              <FormControl>
                <Input
                  placeholder="******"
                  type="password"
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-full bg-primary hover:bg-primary-dark text-black font-semibold"
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Iniciando sesión...
            </>
          ) : (
            "Iniciar Sesión"
          )}
        </Button>
      </form>
    </Form>
  );
}

function RegisterForm() {
  const { registerMutation } = useAuth();
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = (values: RegisterFormValues) => {
    registerMutation.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre Completo</FormLabel>
              <FormControl>
                <Input
                  placeholder="Tu nombre completo"
                  autoComplete="name"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre de Usuario</FormLabel>
              <FormControl>
                <Input
                  placeholder="username"
                  autoComplete="username"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Correo Electrónico</FormLabel>
              <FormControl>
                <Input
                  placeholder="tu@email.com"
                  type="email"
                  autoComplete="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contraseña</FormLabel>
              <FormControl>
                <Input
                  placeholder="******"
                  type="password"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-full bg-primary hover:bg-primary-dark text-black font-semibold"
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Registrando...
            </>
          ) : (
            "Crear Cuenta"
          )}
        </Button>
      </form>
    </Form>
  );
}