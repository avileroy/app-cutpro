"use client"

import { useState, useEffect } from "react"
import { Plus, TrendingUp, TrendingDown, Target, Award, Settings, PieChart, Wallet, CreditCard, Home, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { supabase, type Transaction, type Goal, type Achievement, type UserProfile } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

export default function CutProApp() {
  const { toast } = useToast()
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("dashboard")
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false)
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false)

  // Carregar dados do usuário
  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      // Verificar se usuário está autenticado
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        // Criar usuário temporário para demo (em produção, usar autenticação real)
        const tempUserId = localStorage.getItem('cutpro_temp_user_id')
        if (tempUserId) {
          setUserId(tempUserId)
          await loadUserProfile(tempUserId)
          await loadTransactions(tempUserId)
          await loadGoals(tempUserId)
          await loadAchievements(tempUserId)
        } else {
          // Criar novo usuário temporário
          const newUserId = crypto.randomUUID()
          localStorage.setItem('cutpro_temp_user_id', newUserId)
          setUserId(newUserId)
          await createUserProfile(newUserId)
        }
      } else {
        setUserId(user.id)
        await loadUserProfile(user.id)
        await loadTransactions(user.id)
        await loadGoals(user.id)
        await loadAchievements(user.id)
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const createUserProfile = async (uid: string) => {
    const { error } = await supabase
      .from('user_profile')
      .insert([{ user_id: uid, xp: 0, level: 1, total_saved: 0 }])
    
    if (!error) {
      setUserProfile({ user_id: uid, xp: 0, level: 1, total_saved: 0, updated_at: new Date().toISOString() })
    }
  }

  const loadUserProfile = async (uid: string) => {
    const { data, error } = await supabase
      .from('user_profile')
      .select('*')
      .eq('user_id', uid)
      .single()

    if (data) {
      setUserProfile(data)
    } else if (error && error.code === 'PGRST116') {
      // Perfil não existe, criar um novo
      await createUserProfile(uid)
    }
  }

  const loadTransactions = async (uid: string) => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', uid)
      .order('date', { ascending: false })

    if (data) {
      setTransactions(data)
    }
  }

  const loadGoals = async (uid: string) => {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })

    if (data) {
      setGoals(data)
    }
  }

  const loadAchievements = async (uid: string) => {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .eq('user_id', uid)
      .order('unlocked_at', { ascending: false })

    if (data) {
      setAchievements(data)
    }
  }

  const handleAddTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!userId) return

    const formData = new FormData(e.currentTarget)
    const type = formData.get("type") as "income" | "expense"
    const amount = parseFloat(formData.get("amount") as string)
    const category = formData.get("category") as string
    const description = formData.get("description") as string

    const { data, error } = await supabase
      .from('transactions')
      .insert([{
        user_id: userId,
        type,
        amount,
        category,
        description,
        date: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a transação",
        variant: "destructive"
      })
      return
    }

    if (data) {
      setTransactions([data, ...transactions])
      
      // Atualizar perfil do usuário
      if (userProfile) {
        const newTotalSaved = type === 'income' 
          ? userProfile.total_saved + amount 
          : userProfile.total_saved - amount
        
        await supabase
          .from('user_profile')
          .update({ total_saved: newTotalSaved })
          .eq('user_id', userId)

        setUserProfile({ ...userProfile, total_saved: newTotalSaved })
      }

      // Verificar conquista de primeira transação
      if (transactions.length === 0) {
        await unlockAchievement("Primeiro Passo", "Registre sua primeira transação", 10)
      }

      toast({
        title: "Sucesso!",
        description: "Transação adicionada com sucesso"
      })
    }

    setIsAddTransactionOpen(false)
  }

  const handleAddGoal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!userId) return

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const target = parseFloat(formData.get("target") as string)

    const { data, error } = await supabase
      .from('goals')
      .insert([{
        user_id: userId,
        name,
        target_amount: target,
        current_amount: 0
      }])
      .select()
      .single()

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível criar a meta",
        variant: "destructive"
      })
      return
    }

    if (data) {
      setGoals([data, ...goals])

      // Verificar conquista de primeira meta
      if (goals.length === 0) {
        await unlockAchievement("Planejador", "Crie sua primeira meta", 25)
      }

      toast({
        title: "Sucesso!",
        description: "Meta criada com sucesso"
      })
    }

    setIsAddGoalOpen(false)
  }

  const unlockAchievement = async (title: string, description: string, xp: number) => {
    if (!userId) return

    // Verificar se já foi desbloqueada
    const exists = achievements.find(a => a.title === title)
    if (exists) return

    const { data, error } = await supabase
      .from('achievements')
      .insert([{
        user_id: userId,
        title,
        description,
        xp
      }])
      .select()
      .single()

    if (data) {
      setAchievements([data, ...achievements])

      // Atualizar XP do usuário
      if (userProfile) {
        const newXP = userProfile.xp + xp
        const newLevel = Math.floor(newXP / 50) + 1

        await supabase
          .from('user_profile')
          .update({ xp: newXP, level: newLevel })
          .eq('user_id', userId)

        setUserProfile({ ...userProfile, xp: newXP, level: newLevel })

        toast({
          title: "🎉 Conquista Desbloqueada!",
          description: `${title} (+${xp} XP)`
        })
      }
    }
  }

  const totalIncome = transactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0)

  const totalExpenses = transactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0)

  const balance = userProfile?.total_saved || 0

  const expensesByCategory = transactions
    .filter(t => t.type === "expense")
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount
      return acc
    }, {} as Record<string, number>)

  const totalXP = userProfile?.xp || 0
  const currentLevel = userProfile?.level || 1
  const xpForNextLevel = currentLevel * 50
  const xpProgress = (totalXP % 50) / 50 * 100

  const navItems = [
    { id: "dashboard", label: "Início", icon: Home },
    { id: "transactions", label: "Transações", icon: CreditCard },
    { id: "goals", label: "Metas", icon: Target },
    { id: "achievements", label: "Conquistas", icon: Award },
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-semibold text-slate-600 dark:text-slate-400">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 pb-32">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <CreditCard className="w-10 h-10 text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-green-600 opacity-20 blur-xl"></div>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                CutPro
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400">Controle suas finanças</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* XP Bar - Grande e destacada acima do saldo */}
          <Card className="bg-gradient-to-r from-purple-600 via-blue-600 to-green-600 text-white border-0 shadow-2xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-4 border-white/30">
                    <Award className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-white/80 font-medium">Nível Atual</p>
                    <p className="text-5xl font-black">{currentLevel}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white/80 font-medium">Total XP</p>
                  <p className="text-3xl font-bold">{totalXP} XP</p>
                  <p className="text-xs text-white/70 mt-1">Próximo nível: {xpForNextLevel} XP</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Progresso para Nível {currentLevel + 1}</span>
                  <span className="font-bold">{xpProgress.toFixed(0)}%</span>
                </div>
                <div className="h-4 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                  <div 
                    className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-500 shadow-lg"
                    style={{ width: `${xpProgress}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Balance Card */}
            <Card className="bg-gradient-to-br from-blue-600 to-green-600 text-white border-0 shadow-2xl">
              <CardHeader>
                <CardDescription className="text-blue-100">Saldo Atual</CardDescription>
                <CardTitle className="text-5xl font-bold">
                  R$ {balance.toFixed(2).replace(".", ",")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex gap-4">
                <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-200 mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm">Receitas</span>
                  </div>
                  <p className="text-2xl font-bold">R$ {totalIncome.toFixed(2).replace(".", ",")}</p>
                </div>
                <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-200 mb-1">
                    <TrendingDown className="w-4 h-4" />
                    <span className="text-sm">Despesas</span>
                  </div>
                  <p className="text-2xl font-bold">R$ {totalExpenses.toFixed(2).replace(".", ",")}</p>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Recent Transactions */}
              <Card className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    Transações Recentes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {transactions.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <p>Nenhuma transação ainda</p>
                      <p className="text-sm mt-2">Adicione sua primeira transação!</p>
                    </div>
                  ) : (
                    transactions.slice(0, 5).map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            transaction.type === "income" 
                              ? "bg-green-100 dark:bg-green-900/30" 
                              : "bg-red-100 dark:bg-red-900/30"
                          }`}>
                            {transaction.type === "income" ? (
                              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                            ) : (
                              <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{transaction.description}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{transaction.category}</p>
                          </div>
                        </div>
                        <p className={`font-bold ${
                          transaction.type === "income" ? "text-green-600" : "text-red-600"
                        }`}>
                          {transaction.type === "income" ? "+" : "-"}R$ {transaction.amount.toFixed(2).replace(".", ",")}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Goals Progress */}
              <Card className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-green-600" />
                    Metas Financeiras
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {goals.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <p>Nenhuma meta criada</p>
                      <p className="text-sm mt-2">Crie sua primeira meta financeira!</p>
                    </div>
                  ) : (
                    goals.slice(0, 3).map((goal) => {
                      const progress = (goal.current_amount / goal.target_amount) * 100
                      return (
                        <div key={goal.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-medium">{goal.name}</p>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                  R$ {goal.current_amount.toFixed(2)} / R$ {goal.target_amount.toFixed(2)}
                                </p>
                              </div>
                            </div>
                            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              {progress.toFixed(0)}%
                            </Badge>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>
                      )
                    })
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Expenses by Category */}
            {Object.keys(expensesByCategory).length > 0 && (
              <Card className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-purple-600" />
                    Gastos por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {Object.entries(expensesByCategory).map(([category, amount]) => {
                      const percentage = (amount / totalExpenses) * 100
                      return (
                        <div key={category} className="p-4 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700">
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{category}</p>
                          <p className="text-2xl font-bold mb-2">R$ {amount.toFixed(2).replace(".", ",")}</p>
                          <Progress value={percentage} className="h-1.5" />
                          <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{percentage.toFixed(1)}% do total</p>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Transactions */}
          <TabsContent value="transactions" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Todas as Transações</h2>
              <Dialog open={isAddTransactionOpen} onOpenChange={setIsAddTransactionOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 shadow-lg">
                    <Plus className="w-4 h-4" />
                    Nova Transação
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Transação</DialogTitle>
                    <DialogDescription>
                      Registre uma nova receita ou despesa
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddTransaction} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="type">Tipo</Label>
                      <Select name="type" defaultValue="expense">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">Receita</SelectItem>
                          <SelectItem value="expense">Despesa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount">Valor</Label>
                      <Input
                        id="amount"
                        name="amount"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Categoria</Label>
                      <Select name="category" defaultValue="Alimentação">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Alimentação">Alimentação</SelectItem>
                          <SelectItem value="Transporte">Transporte</SelectItem>
                          <SelectItem value="Lazer">Lazer</SelectItem>
                          <SelectItem value="Saúde">Saúde</SelectItem>
                          <SelectItem value="Educação">Educação</SelectItem>
                          <SelectItem value="Moradia">Moradia</SelectItem>
                          <SelectItem value="Salário">Salário</SelectItem>
                          <SelectItem value="Outros">Outros</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Input
                        id="description"
                        name="description"
                        placeholder="Ex: Supermercado"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-green-600">
                      Adicionar
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="shadow-lg">
              <CardContent className="p-0">
                {transactions.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <CreditCard className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <p className="text-lg font-semibold">Nenhuma transação ainda</p>
                    <p className="text-sm mt-2">Adicione sua primeira transação para começar!</p>
                  </div>
                ) : (
                  <div className="divide-y dark:divide-slate-800">
                    {transactions.map((transaction) => (
                      <div key={transaction.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              transaction.type === "income" 
                                ? "bg-green-100 dark:bg-green-900/30" 
                                : "bg-red-100 dark:bg-red-900/30"
                            }`}>
                              {transaction.type === "income" ? (
                                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                              ) : (
                                <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-lg">{transaction.description}</p>
                              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                <Badge variant="outline">{transaction.category}</Badge>
                                <span>•</span>
                                <span>{new Date(transaction.date).toLocaleDateString("pt-BR")}</span>
                              </div>
                            </div>
                          </div>
                          <p className={`text-2xl font-bold ${
                            transaction.type === "income" ? "text-green-600" : "text-red-600"
                          }`}>
                            {transaction.type === "income" ? "+" : "-"}R$ {transaction.amount.toFixed(2).replace(".", ",")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Goals */}
          <TabsContent value="goals" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Minhas Metas</h2>
              <Dialog open={isAddGoalOpen} onOpenChange={setIsAddGoalOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 shadow-lg">
                    <Plus className="w-4 h-4" />
                    Nova Meta
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Meta Financeira</DialogTitle>
                    <DialogDescription>
                      Defina uma nova meta de economia
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddGoal} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome da Meta</Label>
                      <Input
                        id="name"
                        name="name"
                        placeholder="Ex: Viagem de Férias"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="target">Valor Alvo</Label>
                      <Input
                        id="target"
                        name="target"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-green-600">
                      Criar Meta
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {goals.length === 0 ? (
              <Card className="shadow-lg">
                <CardContent className="text-center py-12 text-slate-500">
                  <Target className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-semibold">Nenhuma meta criada</p>
                  <p className="text-sm mt-2">Crie sua primeira meta financeira para começar a economizar!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {goals.map((goal) => {
                  const progress = (goal.current_amount / goal.target_amount) * 100
                  return (
                    <Card key={goal.id} className="shadow-lg hover:shadow-xl transition-all hover:scale-105">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <CardTitle className="text-xl">{goal.name}</CardTitle>
                            <CardDescription>
                              R$ {goal.current_amount.toFixed(2)} / R$ {goal.target_amount.toFixed(2)}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium">Progresso</span>
                            <span className="text-sm font-bold text-green-600">{progress.toFixed(1)}%</span>
                          </div>
                          <Progress value={progress} className="h-3" />
                        </div>
                        <div className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950/30 dark:to-green-950/30 border border-blue-200 dark:border-blue-800">
                          <p className="text-sm text-slate-600 dark:text-slate-400">Faltam</p>
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            R$ {(goal.target_amount - goal.current_amount).toFixed(2).replace(".", ",")}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* Achievements */}
          <TabsContent value="achievements" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Conquistas</h2>
                <p className="text-slate-600 dark:text-slate-400">Desbloqueie conquistas e ganhe XP</p>
              </div>
            </div>

            {achievements.length === 0 ? (
              <Card className="shadow-lg">
                <CardContent className="text-center py-12 text-slate-500">
                  <Award className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-semibold">Nenhuma conquista ainda</p>
                  <p className="text-sm mt-2">Complete ações para desbloquear conquistas e ganhar XP!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {achievements.map((achievement) => (
                  <Card 
                    key={achievement.id} 
                    className="shadow-lg transition-all bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 border-yellow-300 dark:border-yellow-800"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-yellow-400 to-orange-500">
                          <Award className="w-8 h-8 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg">{achievement.title}</h3>
                            <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
                              +{achievement.xp} XP
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {achievement.description}
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">
                            ✓ Desbloqueada
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Bottom Navigation Bar - Ícones grandes e intuitivos */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 shadow-2xl z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-around py-3">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex flex-col items-center gap-1.5 px-6 py-2 rounded-2xl transition-all duration-300 ${
                    isActive 
                      ? "bg-gradient-to-r from-blue-600 to-green-600 text-white shadow-lg scale-110" 
                      : "text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:scale-105"
                  }`}
                >
                  <Icon className={`${isActive ? "w-7 h-7" : "w-6 h-6"} transition-all`} strokeWidth={2.5} />
                  <span className={`text-xs font-semibold ${isActive ? "text-white" : ""}`}>
                    {item.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>
    </div>
  )
}
