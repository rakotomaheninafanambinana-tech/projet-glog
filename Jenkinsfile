pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                echo 'Récupération du code source depuis le dépôt Git...'
                checkout scm
            }
        }
        
        stage('Install Dependencies') {
            steps {
                echo 'Installation des dépendances de l\'application...'
                sh 'npm install'
            }
        }

        stage('Run Tests') {
            steps {
                echo 'Exécution des tests unitaires automatisés...'
                sh 'npm test'
            }
        }

        stage('Deploy to Cloud') {
            steps {
                echo 'Déclenchement du déploiement automatique sur Render...'
                // Remplace 'MON_DEPLOY_HOOK_RENDER' par l'URL fournie par Render
                sh 'curl -X POST MON_DEPLOY_HOOK_RENDER'
            }
        }
    }
    
    post {
        success {
            echo '✅ Pipeline exécuté avec succès : Tests validés et application déployée !'
        }
        failure {
            echo '❌ Échec du pipeline : Les tests ont échoué, le déploiement est annulé.'
        }
    }
}