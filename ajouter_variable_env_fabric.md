# Ajout de variables d'environnement sur Fabric (hors Azure Vault Key)

Dans l'exemple suivant, le nom de la variable d'environnement sera : `SUPABASE_URL`
1. Ajouter dans la Bibliothèque de variables les variables souhaitées. Si le pipeline est nouveau ou sans bibliothèque associée créer une bibliothèque ``env-<PIPELINE_PREFIX>`` ex : _env-lucca_
2. Aller dans le pipeline > Mettre à jour le pipeline > Variable de bibliothèque puis ajouter les variables unes par unes. 
    
    Attention ! Par défaut les variables importées dans un pipeline sera `env<PIPELINE_PREFIX>_SUPABASE_URL`

    Ne pas oublier de bien la renommer ensuite.
3. Dans l'onglet `Variables`  du pipeline ajouter les variables une par une avec comme valeur par défaut : `@pipeline().libraryVariables.SUPABASE_URL`
4. Dans l'onglet `Réglages` répéter l'opération avec comme valeur par défaut : `@variables('SUPABASE_URL')`
5. Pour chaque Notebook qui aura besoin de faire appel à des variables d'environnement, Sélectionner le Notebook > Paramètres > Paramètres de base et ajouter les variables.

Nom |Type | Valeur
SUPABASE_URL | Chaine/string | `@variables('SUPABASE_URL')`

6. Dans le notebook il suffira de faire un appel classique.
la
Attention cependant ! L'import fait ici est uniquement adapté pour le lancement du pipeline entier, un lancement manuel des cellules renvoie des variables d'environnement vide. Pour remédier à cela, créer un cellule en haut de chaque notebook avec l'import manuel des variables. Il suffira alors de décommenter la cellule au momment de lancer manuellement le notebook.

_Exemple :_

```python
"""  Cellule à faire tourner uniquement manuellement
// Import de la bibliothèque de variables
env = notebookutils.variableLibrary.getLibrary("env-temp")

// Initialisation des variables
SUPABASE_URL = env.SUPABASE_URL
SYNC_SECRET = env.SYNC_SECRET
SUPABASE_ANON_KEY =env.SUPABASE_PUBLISHABLE_KEY
#SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY
"""
print("Début du pipeline")
```