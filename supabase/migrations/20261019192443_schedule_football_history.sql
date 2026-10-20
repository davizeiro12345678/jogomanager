SELECT cron.schedule('api-football-history','* * * * *','SELECT football_import_private.invoke_worker();');
