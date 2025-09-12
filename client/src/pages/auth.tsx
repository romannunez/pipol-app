import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import LoadingSpinner from '@/components/ui/loading-spinner';

// Login form schema
const loginSchema = z.object({
  email: z.string().email({ message: 'Correo electrónico inválido' }),
  password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Register form schema
const registerSchema = z.object({
  name: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres' }),
  username: z.string().min(3, { message: 'El nombre de usuario debe tener al menos 3 caracteres' }),
  email: z.string().email({ message: 'Correo electrónico inválido' }),
  password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState('login');
  const [_, setLocation] = useLocation();
  const { user, isLoggedIn, loginMutation, registerMutation } = useAuth();
  
  // Use effect for redirection to avoid state updates during render
  useEffect(() => {
    if (isLoggedIn && user) {
      setLocation('/');
    }
  }, [isLoggedIn, user, setLocation]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="h-screen overflow-auto grid md:grid-cols-2 relative"
    >
      {/* Background image with colored overlay */}
      <div className="absolute inset-0 w-full h-full grid md:grid-cols-2 z-0">
        {/* Left side - White background for desktop */}
        <motion.div 
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="hidden md:block relative"
        >
          <div className="absolute inset-0 bg-white" />
        </motion.div>
        
        {/* Right side background - Image 1 for mobile, visible on all screens */}
        <motion.div 
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.8 }}
          className="relative col-span-1 w-full h-full"
        >
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: 'url(/images/1.jpg)' }}
          />
          <div className="absolute inset-0 bg-primary/50" />
        </motion.div>
      </div>

      {/* Hero Section - Hidden on mobile */}
      <motion.div 
        initial={{ x: -30, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="hidden md:flex flex-col justify-center p-6 relative z-10 text-gray-800"
      >
        <div className="max-w-md mx-auto">
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="text-3xl font-bold mb-4"
          >
            Bienvenido a Pipol
          </motion.h1>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="text-lg mb-4"
          >
            Explora eventos cercanos, crea tus propios eventos y conecta con personas que comparten tus intereses.
          </motion.p>
          <motion.div 
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="space-y-3"
          >
            <div className="flex items-start space-x-3">
              <div className="bg-primary/20 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-sm">Descubre eventos</h3>
                <p className="text-xs text-gray-600">Encuentra eventos cerca de ti basados en tus intereses</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="bg-primary/20 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-sm">Conecta con otros</h3>
                <p className="text-xs text-gray-600">Conoce personas nuevas y haz amigos en eventos</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="bg-primary/20 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-sm">Crea tus eventos</h3>
                <p className="text-xs text-gray-600">Organiza tus propios eventos y compártelos</p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Auth Form */}
      <motion.div 
        initial={{ x: 30, opacity: 0, scale: 0.95 }}
        animate={{ x: 0, opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
        className="flex items-center justify-center p-2 overflow-y-auto relative z-10"
      >
        <motion.div
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="w-full max-w-[280px] bg-white/90 backdrop-blur-sm border-none shadow-xl rounded-xl">
          <CardHeader className="py-3 px-4">
            <div className="flex justify-center mb-3">
              <img src="/pipol-logo.png" alt="Pipol Logo" className="h-14" />
            </div>
            <CardDescription className="text-[11px] text-center font-medium">
              {activeTab === 'login' 
                ? 'Inicia sesión en tu cuenta para continuar' 
                : 'Crea una cuenta para empezar a usar Pipol'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <Tabs defaultValue="login" onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-4 h-8 rounded-lg">
                <TabsTrigger value="login" className="text-xs rounded-md">Iniciar Sesión</TabsTrigger>
                <TabsTrigger value="register" className="text-xs rounded-md">Registrarse</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <LoginForm />
              </TabsContent>
              
              <TabsContent value="register">
                <RegisterForm />
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex flex-col py-3 px-4">
            <div className="text-[10px] text-center text-neutral-600">
              Al continuar, aceptas nuestros Términos de Servicio y Política de Privacidad.
            </div>
          </CardFooter>
        </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function LoginForm() {
  const { loginMutation, isLoggedIn } = useAuth();
  const [_, setLocation] = useLocation();
  
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // If user is already logged in, redirect to home
  useEffect(() => {
    if (isLoggedIn) {
      setLocation('/');
    }
  }, [isLoggedIn, setLocation]);

  // Use the login mutation from our auth hook
  const onSubmit = (values: LoginFormValues) => {
    console.log("Submitting login form for:", values.email);
    loginMutation.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px]">Correo</FormLabel>
              <FormControl>
                <Input placeholder="tu@correo.com" {...field} className="h-7 text-xs px-2" />
              </FormControl>
              <FormMessage className="text-[8px]" />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px]">Contraseña</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••" {...field} className="h-7 text-xs px-2" />
              </FormControl>
              <FormMessage className="text-[8px]" />
            </FormItem>
          )}
        />
        
        <Button 
          type="submit" 
          className="w-full h-6 text-xs bg-primary hover:bg-primary/90" 
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? (
            <>
              <LoadingSpinner size={12} className="mr-1" />
              <span className="text-[10px]">Iniciando sesión...</span>
            </>
          ) : (
            <span className="text-[10px]">Iniciar Sesión</span>
          )}
        </Button>
      </form>
    </Form>
  );
}

function RegisterForm() {
  const { registerMutation, isLoggedIn } = useAuth();
  const [_, setLocation] = useLocation();
  
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });
  
  // If user is already logged in, redirect to home
  useEffect(() => {
    if (isLoggedIn) {
      setLocation('/');
    }
  }, [isLoggedIn, setLocation]);

  const onSubmit = (values: RegisterFormValues) => {
    console.log("Submitting registration form for:", values.email);
    // Remove confirmPassword before sending to API
    const { confirmPassword, ...registerData } = values;
    registerMutation.mutate(registerData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px]">Nombre</FormLabel>
                <FormControl>
                  <Input placeholder="Juan Pérez" {...field} className="h-7 text-xs px-2" />
                </FormControl>
                <FormMessage className="text-[8px]" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px]">Usuario</FormLabel>
                <FormControl>
                  <Input placeholder="juanperez" {...field} className="h-7 text-xs px-2" />
                </FormControl>
                <FormMessage className="text-[8px]" />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px]">Correo</FormLabel>
              <FormControl>
                <Input placeholder="tu@correo.com" {...field} className="h-7 text-xs px-2" />
              </FormControl>
              <FormMessage className="text-[8px]" />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-2 gap-2">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px]">Contraseña</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••" {...field} className="h-7 text-xs px-2" />
                </FormControl>
                <FormMessage className="text-[8px]" />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px]">Confirmar</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••" {...field} className="h-7 text-xs px-2" />
                </FormControl>
                <FormMessage className="text-[8px]" />
              </FormItem>
            )}
          />
        </div>
        
        <Button 
          type="submit" 
          className="w-full h-6 text-xs bg-primary hover:bg-primary/90" 
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? (
            <>
              <LoadingSpinner size={12} className="mr-1" />
              <span className="text-[10px]">Registrando...</span>
            </>
          ) : (
            <span className="text-[10px]">Crear Cuenta</span>
          )}
        </Button>
      </form>
    </Form>
  );
}